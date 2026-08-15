# Database

Models: User, RefreshToken, OtpVerification, PasskeyCredential, TrustedContact, Device, Route, Journey, JourneyLocationPoint, Hazard, HazardConfirmation, RouteMemory, Notification, ChatRoom, ChatMessage, ChatReaction, ChatReport, BlockedUser, UserReputation, AuditLog.

Geospatial `2dsphere` indexes exist on journey points and hazards. OTP/refresh/hazard expiry fields use TTL indexes. Composite unique indexes prevent duplicate email, route memories, confirmations, reactions and blocks.
