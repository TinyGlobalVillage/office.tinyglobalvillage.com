/**
 * Shared Front Desk domain types. All Front Desk storage libs read/write these.
 * Every phone number field is E.164 (`+15551234567`) — enforced on write.
 */

export type DidAssignment =
  | { kind: "frontdesk" }            // routed to shift-worker via dialplan
  | { kind: "user"; username: string } // direct to a specific user
  | { kind: "unassigned" };

export type Did = {
  id: string;              // internal id `did_<ts>_<rand>`
  e164: string;            // `+15551234567`
  label: string;           // human name, e.g. "TGV Main" or "Marthe's line"
  assignment: DidAssignment;
  telnyxId: string | null; // Telnyx resource id (null while not yet provisioned)
  createdBy: string;
  createdAt: string;       // ISO
  releasedAt: string | null;
};

export type ContactKind = "client" | "employee";

export type Contact = {
  id: string;                // `ct_<ts>_<rand>`
  kind: ContactKind;
  name: string;
  phone: string | null;      // E.164 or null
  email: string | null;
  company: string | null;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastContactAt: string | null;
};

export type CallDirection = "inbound" | "outbound";
export type CallOutcome =
  | "answered"
  | "declined"
  | "missed"
  | "voicemail"
  | "failed";

export type CallRecord = {
  id: string;                   // `call_<ts>_<rand>`
  didId: string | null;         // which local DID handled it
  direction: CallDirection;
  fromE164: string;
  toE164: string;
  answeredBy: string | null;    // username of the user who picked up
  startedAt: string;
  answeredAt: string | null;
  endedAt: string | null;
  durationSec: number;
  outcome: CallOutcome;
  recordingPath: string | null; // relative to data/telephony/recordings/
  voicemailPath: string | null; // relative to data/telephony/voicemail/
  telnyxCallControlId: string | null;
  consentAcknowledged: boolean;
  /**
   * Which user(s) should see the ring popup while answeredAt === null.
   *   - string: specific username (shift-worker or direct DID assignment)
   *   - "*":    ring-all-online fallback stage
   *   - null:   no longer ringing (either answered, declined, or pre-ring)
   */
  ringTarget: string | "*" | null;
  ringStartedAt: string | null; // ISO; used by clients to drive the 30s countdown
};

export type SmsDirection = "inbound" | "outbound";

export type SmsMessage = {
  id: string;                  // `sms_<ts>_<rand>`
  direction: SmsDirection;
  fromE164: string;
  toE164: string;
  body: string;
  createdAt: string;
  readBy: string[];            // usernames who've seen it
  sentBy: string | null;       // username who composed an outbound message
  telnyxMessageId: string | null;
};

export type AlertSource = "website-form" | "manual" | "system";

export type Alert = {
  id: string;                 // `al_<ts>_<rand>`
  source: AlertSource;
  subject: string;
  body: string;
  fromName: string | null;
  fromEmail: string | null;
  fromPhone: string | null;
  payload: Record<string, unknown>; // raw form payload
  createdAt: string;
  readBy: string[];
  archivedAt: string | null;
};

export type ShiftAssignment = {
  username: string | null;    // null = no one assigned (inbound falls straight to ring-all)
  updatedBy: string;
  updatedAt: string;
};
