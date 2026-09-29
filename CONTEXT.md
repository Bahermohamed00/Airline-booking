# Airline Booking

Lufthansa-inspired airline management & booking platform (Angular + NestJS + Prisma/PostgreSQL). This glossary fixes the canonical domain language; use these terms in code, tests, and docs.

## Language

### Identity & Access

**User**:
A login account identified by email, holding a password hash and one or more Roles. A User is not necessarily a Passenger.
_Avoid_: Account

**Passenger**:
A person traveling on a Booking. A Passenger may exist without a User (e.g. booked by someone else).
_Avoid_: traveler, customer

**Customer**:
A User holding the Customer role: books and manages only their own data.
_Avoid_: client, buyer

**Guest**:
An unauthenticated visitor. A Guest has no User and can only search and view public information.
_Avoid_: anonymous user

**Staff**:
A User holding any back-office Role (Support Staff, Flight Manager, Booking Manager, Finance Staff, Administrator, Super Admin).
_Avoid_: employee, agent

**Session**:
One authenticated device context for a User, created at login and revocable. Owns a chain of Refresh Tokens.
_Avoid_: device, connection

**Access Token**:
A short-lived (15 min) JWT bearer credential carrying the User id and Session id.
_Avoid_: token (unqualified)

**Refresh Token**:
An opaque, single-use credential that rotates on every use and is stored only as a hash. Belongs to exactly one Session.
_Avoid_: token (unqualified)

**Password Reset Token**:
An opaque, single-use credential emailed for account recovery, stored only as a hash, expiring after one hour. Requesting a new one invalidates all previous ones.
_Avoid_: token (unqualified)

**Role**:
A named bundle of Permissions assignable to Users (e.g. Booking Manager).
_Avoid_: group

**Permission**:
A `resource:action` pair (e.g. `bookings:manage`) authorizing one class of operation.
_Avoid_: scope, claim

### Booking

**Booking**:
A purchase of seats on a Flight, owned by exactly one User and identified publicly by its Booking Reference. The SRS says "reservation"; the code says Booking.
_Avoid_: order, reservation

**Booking Reference**:
The 6-character public identifier of a Booking (the PNR shown to customers).
_Avoid_: PNR (in code), booking id (that's the UUID)

**Seat Hold**:
A time-boxed lock on a Seat during checkout; it either expires or converts into a booked seat.
_Avoid_: reservation, lock
