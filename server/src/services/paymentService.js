import PaymentEvent from '../models/PaymentEvent.js';
import Registration from '../models/Registration.js';
import { TicketInventoryEngine } from './ticketInventoryEngine.js';
import { PaymentProvider } from '../integrations/payment/paymentProvider.js';
import { AppError } from '../utils/AppError.js';
import { REGISTRATION_STATUS } from '../utils/constants.js';

export class PaymentService {
  /**
   * Initializes a payment intent with the payment provider.
   */
  static async createPaymentIntent({ registrationId, user }) {
    const reg = await Registration.findById(registrationId);
    if (!reg) throw new AppError('Registration not found.', 404, 'NOT_FOUND');

    if (user.globalRole !== 'platform_admin' && reg.userRef.toString() !== user._id.toString()) {
      throw new AppError('Forbidden: Cannot pay for another user’s registration.', 403, 'FORBIDDEN');
    }

    if (reg.status !== REGISTRATION_STATUS.HELD) {
      throw new AppError(
        `Cannot initialize payment: Registration is in status '${reg.status}', expected 'held'.`,
        400,
        'INVALID_PAYMENT_STATE'
      );
    }

    if (reg.holdExpiresAt && new Date() > new Date(reg.holdExpiresAt)) {
      throw new AppError('Cannot initialize payment: Ticket hold has expired.', 410, 'TICKET_HOLD_EXPIRED');
    }

    if (reg.totalAmountPaid <= 0) {
      throw new AppError('Cannot initialize payment for zero-amount registration.', 400, 'INVALID_AMOUNT');
    }

    const intent = await PaymentProvider.createPaymentIntent({
      amount: reg.totalAmountPaid,
      currency: 'USD',
      metadata: {
        registrationId: reg._id.toString(),
        eventRef: reg.eventRef.toString(),
        userRef: reg.userRef.toString()
      }
    });

    reg.paymentIntentId = intent.id;
    await reg.save();

    return {
      paymentIntent: intent,
      registration: reg
    };
  }

  /**
   * Authoritative, idempotent webhook ingestion pipeline.
   * Enforces durable idempotency via PaymentEvent collection unique index { provider: 1, eventId: 1 }.
   */
  static async handleWebhookEvent({ provider = 'mock', rawBody, signature }) {
    if (!rawBody) {
      throw new AppError('Missing raw webhook payload.', 400, 'MISSING_PAYLOAD');
    }

    // 1. Verify cryptographic signature and parse payload
    const event = PaymentProvider.parseWebhookEvent({ rawBody, signature });

    const eventId = event.id;
    const eventType = event.type;
    const registrationId =
      event.data?.object?.metadata?.registrationId || event.metadata?.registrationId || null;

    // 2. Check and record event idempotency
    let paymentEvent;
    try {
      paymentEvent = await PaymentEvent.create({
        provider,
        eventId,
        eventType,
        registrationRef: registrationId,
        payload: event.data?.object || event,
        status: 'received'
      });
    } catch (err) {
      if (err.code === 11000) {
        // Event already received and processed! Idempotent replay: return harmless success
        return {
          status: 'duplicate_ignored',
          message: `Webhook event '${eventId}' has already been processed.`
        };
      }
      throw err;
    }

    // 3. Process payment success
    if (eventType === 'payment_intent.succeeded' && registrationId) {
      const paymentIntentId = event.data?.object?.id || eventId;
      await TicketInventoryEngine.confirmPayment({ registrationId, paymentIntentId });

      paymentEvent.status = 'processed';
      paymentEvent.processedAt = new Date();
      await paymentEvent.save();
    }

    return {
      status: 'processed',
      paymentEvent
    };
  }

  /**
   * Client-side verification callback.
   * Does NOT accept client assertions; verifies provider status before triggering confirmation.
   */
  static async verifyClientPayment({ registrationId, paymentIntentId, user }) {
    const reg = await Registration.findById(registrationId);
    if (!reg) throw new AppError('Registration not found.', 404, 'NOT_FOUND');

    if (user.globalRole !== 'platform_admin' && reg.userRef.toString() !== user._id.toString()) {
      throw new AppError('Forbidden: Cannot verify another user’s payment.', 403, 'FORBIDDEN');
    }

    // If already confirmed, return idempotently
    if (reg.status === REGISTRATION_STATUS.CONFIRMED) {
      return reg;
    }

    // Query payment provider for authoritative state
    const providerStatus = await PaymentProvider.getPaymentStatus(paymentIntentId);
    if (providerStatus.status !== 'succeeded') {
      throw new AppError('Payment has not been completed with the payment provider.', 400, 'PAYMENT_FAILED');
    }

    // Authoritative confirmation
    const confirmedReg = await TicketInventoryEngine.confirmPayment({
      registrationId,
      paymentIntentId
    });

    return confirmedReg;
  }
}
