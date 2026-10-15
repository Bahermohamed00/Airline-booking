--
-- PostgreSQL database dump
--

\restrict KkW3Z2AFFl7H3wnbyloWcCZOu98txm2sOXyBiJcyTswUSUrFQFhjquzr3W3bkgm

-- Dumped from database version 18.6
-- Dumped by pg_dump version 18.6

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: aircraft_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.aircraft_status AS ENUM (
    'ACTIVE',
    'MAINTENANCE',
    'RETIRED'
);


--
-- Name: airport_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.airport_status AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


--
-- Name: baggage_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.baggage_status AS ENUM (
    'CHECKED_IN',
    'LOADED',
    'IN_TRANSIT',
    'ARRIVED',
    'DELIVERED',
    'LOST',
    'DELAYED'
);


--
-- Name: baggage_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.baggage_type AS ENUM (
    'CARRY_ON',
    'CHECKED',
    'SPECIAL'
);


--
-- Name: booking_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.booking_status AS ENUM (
    'PENDING',
    'CONFIRMED',
    'CANCELLED',
    'CHECKED_IN',
    'BOARDED',
    'NO_SHOW'
);


--
-- Name: cabin_class; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cabin_class AS ENUM (
    'ECONOMY',
    'PREMIUM_ECONOMY',
    'BUSINESS',
    'FIRST'
);


--
-- Name: cancellation_request_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.cancellation_request_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


--
-- Name: check_in_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.check_in_status AS ENUM (
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: discount_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.discount_type AS ENUM (
    'PERCENT',
    'FIXED_AMOUNT'
);


--
-- Name: extra_service_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.extra_service_status AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


--
-- Name: flight_schedule_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.flight_schedule_status AS ENUM (
    'ONTIME',
    'DELAYED',
    'CANCELLED'
);


--
-- Name: flight_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.flight_status AS ENUM (
    'SCHEDULED',
    'ACTIVE',
    'DELAYED',
    'CANCELLED',
    'COMPLETED'
);


--
-- Name: loyalty_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.loyalty_tier AS ENUM (
    'MEMBER',
    'SILVER',
    'GOLD',
    'HON_CIRCLE'
);


--
-- Name: loyalty_transaction_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.loyalty_transaction_type AS ENUM (
    'EARN',
    'BURN',
    'ADJUSTMENT',
    'EXPIRY'
);


--
-- Name: notification_channel; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_channel AS ENUM (
    'EMAIL',
    'SMS',
    'PUSH',
    'IN_APP'
);


--
-- Name: notification_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_status AS ENUM (
    'PENDING',
    'SENT',
    'DELIVERED',
    'FAILED',
    'RETRYING'
);


--
-- Name: notification_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.notification_type AS ENUM (
    'BOOKING_CONFIRMED',
    'PAYMENT_SUCCEEDED',
    'PAYMENT_FAILED',
    'CANCELLATION_APPROVED',
    'CANCELLATION_REJECTED',
    'REFUND_PROCESSED',
    'REFUND_REVIEW_REQUIRED'
);


--
-- Name: offer_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.offer_status AS ENUM (
    'DRAFT',
    'ACTIVE',
    'INACTIVE',
    'EXPIRED'
);


--
-- Name: orphan_refund_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.orphan_refund_status AS ENUM (
    'UNMATCHED',
    'RESOLVED'
);


--
-- Name: passenger_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.passenger_type AS ENUM (
    'ADULT',
    'CHILD',
    'INFANT'
);


--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_status AS ENUM (
    'PENDING',
    'AUTHORIZED',
    'SUCCESS',
    'FAILED',
    'REFUNDED',
    'PARTIALLY_REFUNDED'
);


--
-- Name: payment_webhook_event_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.payment_webhook_event_status AS ENUM (
    'RECEIVED',
    'PROCESSED',
    'FAILED',
    'IGNORED'
);


--
-- Name: refund_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.refund_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'PROCESSED'
);


--
-- Name: route_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.route_status AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


--
-- Name: schedule_rule_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.schedule_rule_status AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


--
-- Name: seat_hold_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.seat_hold_status AS ENUM (
    'ACTIVE',
    'EXPIRED',
    'CONVERTED',
    'RELEASED'
);


--
-- Name: user_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_status AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'DEACTIVATED',
    'PENDING_VERIFICATION'
);


--
-- Name: weekday; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.weekday AS ENUM (
    'MON',
    'TUE',
    'WED',
    'THU',
    'FRI',
    'SAT',
    'SUN'
);


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._prisma_migrations (
    id character varying(36) NOT NULL,
    checksum character varying(64) NOT NULL,
    finished_at timestamp with time zone,
    migration_name character varying(255) NOT NULL,
    logs text,
    rolled_back_at timestamp with time zone,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    applied_steps_count integer DEFAULT 0 NOT NULL
);


--
-- Name: aircraft; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aircraft (
    id uuid NOT NULL,
    registration character varying(50) NOT NULL,
    model character varying(100) NOT NULL,
    capacity integer NOT NULL,
    status public.aircraft_status DEFAULT 'ACTIVE'::public.aircraft_status NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


--
-- Name: airports; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.airports (
    id uuid NOT NULL,
    iata_code character varying(3) NOT NULL,
    icao_code character varying(4),
    name character varying(200) NOT NULL,
    city character varying(100) NOT NULL,
    country character varying(100) NOT NULL,
    timezone character varying(100) NOT NULL,
    latitude numeric(10,8),
    longitude numeric(11,8),
    status public.airport_status DEFAULT 'ACTIVE'::public.airport_status NOT NULL
);


--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_logs (
    id uuid NOT NULL,
    actor_id uuid,
    actor_type character varying(50) NOT NULL,
    action character varying(100) NOT NULL,
    target_type character varying(100) NOT NULL,
    target_id character varying(255),
    metadata jsonb,
    ip_address character varying(45),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    booking_id uuid
);


--
-- Name: baggage; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.baggage (
    id uuid NOT NULL,
    booking_passenger_id uuid NOT NULL,
    type public.baggage_type DEFAULT 'CHECKED'::public.baggage_type NOT NULL,
    weight_kg integer,
    pieces integer DEFAULT 1 NOT NULL,
    tag_number character varying(50),
    status public.baggage_status DEFAULT 'CHECKED_IN'::public.baggage_status NOT NULL
);


--
-- Name: baggage_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.baggage_events (
    id uuid NOT NULL,
    baggage_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    location character varying(100),
    metadata jsonb,
    occurred_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: boarding_passes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boarding_passes (
    id uuid NOT NULL,
    check_in_id uuid NOT NULL,
    boarding_group character varying(10) NOT NULL,
    seat_number character varying(10) NOT NULL,
    gate character varying(20),
    qr_code text,
    issued_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: booking_extras; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_extras (
    id uuid NOT NULL,
    booking_id uuid NOT NULL,
    extra_service_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    price numeric(12,2) NOT NULL
);


--
-- Name: booking_passengers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_passengers (
    id uuid NOT NULL,
    booking_id uuid NOT NULL,
    passenger_id uuid NOT NULL,
    passenger_type public.passenger_type DEFAULT 'ADULT'::public.passenger_type NOT NULL
);


--
-- Name: booking_seats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.booking_seats (
    id uuid NOT NULL,
    booking_passenger_id uuid NOT NULL,
    flight_segment_id uuid NOT NULL,
    seat_id uuid NOT NULL,
    seat_number character varying(10) NOT NULL
);


--
-- Name: bookings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bookings (
    id uuid NOT NULL,
    booking_reference character varying(10) NOT NULL,
    user_id uuid NOT NULL,
    status public.booking_status DEFAULT 'PENDING'::public.booking_status NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    currency character varying(3) NOT NULL,
    booked_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    contact_email character varying(255) NOT NULL,
    contact_phone character varying(50),
    fare_rules_snapshot jsonb,
    idempotency_key character varying(36),
    idempotency_request_hash character varying(64),
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    offer_id uuid
);


--
-- Name: cancellation_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cancellation_requests (
    id uuid NOT NULL,
    booking_id uuid NOT NULL,
    user_id uuid NOT NULL,
    reason character varying(500),
    status public.cancellation_request_status DEFAULT 'PENDING'::public.cancellation_request_status NOT NULL,
    requested_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    reviewed_at timestamp(6) with time zone,
    reviewed_by uuid,
    rejection_reason character varying(500),
    refund_id uuid,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


--
-- Name: check_ins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.check_ins (
    id uuid NOT NULL,
    booking_passenger_id uuid NOT NULL,
    flight_segment_id uuid NOT NULL,
    check_in_time timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status public.check_in_status DEFAULT 'COMPLETED'::public.check_in_status NOT NULL
);


--
-- Name: email_verification_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.email_verification_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    used_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: extra_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.extra_services (
    id uuid NOT NULL,
    code character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    price numeric(12,2) NOT NULL,
    currency character varying(3) NOT NULL,
    status public.extra_service_status DEFAULT 'ACTIVE'::public.extra_service_status NOT NULL
);


--
-- Name: fares; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fares (
    id uuid NOT NULL,
    flight_id uuid NOT NULL,
    cabin_class public.cabin_class NOT NULL,
    base_price numeric(12,2) NOT NULL,
    tax_amount numeric(12,2) DEFAULT 0 NOT NULL,
    fee_amount numeric(12,2) DEFAULT 0 NOT NULL,
    currency character varying(3) NOT NULL,
    available_count integer NOT NULL,
    fare_rules jsonb
);


--
-- Name: flight_segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flight_segments (
    id uuid NOT NULL,
    flight_id uuid NOT NULL,
    segment_number integer NOT NULL,
    origin_airport_id uuid NOT NULL,
    destination_airport_id uuid NOT NULL,
    departure_time timestamp(6) with time zone NOT NULL,
    arrival_time timestamp(6) with time zone NOT NULL
);


--
-- Name: flights; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.flights (
    id uuid NOT NULL,
    flight_number character varying(20) NOT NULL,
    route_id uuid NOT NULL,
    aircraft_id uuid NOT NULL,
    departure_time timestamp(6) with time zone NOT NULL,
    arrival_time timestamp(6) with time zone NOT NULL,
    status public.flight_status DEFAULT 'SCHEDULED'::public.flight_status NOT NULL,
    schedule_status public.flight_schedule_status DEFAULT 'ONTIME'::public.flight_schedule_status NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    operating_date date,
    schedule_rule_id uuid
);


--
-- Name: loyalty_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_accounts (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    member_number character varying(50) NOT NULL,
    tier public.loyalty_tier DEFAULT 'MEMBER'::public.loyalty_tier NOT NULL,
    balance integer DEFAULT 0 NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


--
-- Name: loyalty_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.loyalty_transactions (
    id uuid NOT NULL,
    loyalty_account_id uuid NOT NULL,
    booking_id uuid,
    amount integer NOT NULL,
    type public.loyalty_transaction_type NOT NULL,
    description text,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: notification_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_templates (
    id uuid NOT NULL,
    code character varying(50) NOT NULL,
    subject character varying(255),
    body text NOT NULL,
    channel public.notification_channel DEFAULT 'EMAIL'::public.notification_channel NOT NULL
);


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid NOT NULL,
    user_id uuid,
    booking_id uuid,
    template_id uuid,
    channel public.notification_channel NOT NULL,
    status public.notification_status DEFAULT 'PENDING'::public.notification_status NOT NULL,
    content text NOT NULL,
    error text,
    sent_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    dedupe_key character varying(150),
    read_at timestamp(6) with time zone,
    title character varying(255) DEFAULT ''::character varying NOT NULL,
    type public.notification_type,
    attempts integer DEFAULT 0 NOT NULL,
    next_retry_at timestamp(6) with time zone
);


--
-- Name: offers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.offers (
    id uuid NOT NULL,
    title character varying(120) NOT NULL,
    description character varying(600) NOT NULL,
    badge character varying(60),
    destination character varying(120),
    offer_value character varying(60),
    terms character varying(600),
    image_url character varying(500),
    status public.offer_status DEFAULT 'DRAFT'::public.offer_status NOT NULL,
    valid_from date NOT NULL,
    valid_until date NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    cabin_class public.cabin_class,
    discount_type public.discount_type,
    discount_value numeric(12,2),
    route_id uuid
);


--
-- Name: orphan_provider_refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.orphan_provider_refunds (
    id uuid NOT NULL,
    provider character varying(50) NOT NULL,
    provider_refund_reference character varying(255) NOT NULL,
    payment_provider_reference character varying(255) NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency character varying(3) NOT NULL,
    status public.orphan_refund_status DEFAULT 'UNMATCHED'::public.orphan_refund_status NOT NULL,
    first_seen_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_seen_at timestamp(6) with time zone NOT NULL,
    resolved_at timestamp(6) with time zone,
    resolved_by character varying(255),
    resolution_note text,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


--
-- Name: passengers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.passengers (
    id uuid NOT NULL,
    user_id uuid,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    date_of_birth date,
    passport_number character varying(50),
    nationality character varying(100),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.password_reset_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    used_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: payment_webhook_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payment_webhook_events (
    id uuid NOT NULL,
    provider character varying(50) NOT NULL,
    event_id character varying(255) NOT NULL,
    event_type character varying(255) NOT NULL,
    status public.payment_webhook_event_status DEFAULT 'RECEIVED'::public.payment_webhook_event_status NOT NULL,
    processing_error text,
    received_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    processed_at timestamp(6) with time zone
);


--
-- Name: payments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payments (
    id uuid NOT NULL,
    booking_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency character varying(3) NOT NULL,
    status public.payment_status DEFAULT 'PENDING'::public.payment_status NOT NULL,
    provider character varying(50) NOT NULL,
    provider_reference character varying(255),
    token character varying(255),
    idempotency_key character varying(255),
    paid_at timestamp(6) with time zone,
    failed_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    provider_status character varying(50)
);


--
-- Name: permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.permissions (
    id uuid NOT NULL,
    resource character varying(100) NOT NULL,
    action character varying(100) NOT NULL,
    description text
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id uuid NOT NULL,
    session_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    rotated_at timestamp(6) with time zone,
    replaced_by_id uuid
);


--
-- Name: refunds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refunds (
    id uuid NOT NULL,
    payment_id uuid NOT NULL,
    booking_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    currency character varying(3) NOT NULL,
    status public.refund_status DEFAULT 'PENDING'::public.refund_status NOT NULL,
    reason text,
    processed_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    provider_reference character varying(255),
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.role_permissions (
    id uuid NOT NULL,
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
);


--
-- Name: roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.roles (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_super_admin boolean DEFAULT false NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


--
-- Name: routes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.routes (
    id uuid NOT NULL,
    origin_airport_id uuid NOT NULL,
    destination_airport_id uuid NOT NULL,
    distance_km integer,
    duration_minutes integer,
    status public.route_status DEFAULT 'ACTIVE'::public.route_status NOT NULL
);


--
-- Name: schedule_rules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schedule_rules (
    id uuid NOT NULL,
    route_id uuid NOT NULL,
    aircraft_id uuid NOT NULL,
    flight_number character varying(20) NOT NULL,
    departure_time_local character varying(5) NOT NULL,
    operating_days public.weekday[],
    effective_from date NOT NULL,
    effective_to date NOT NULL,
    status public.schedule_rule_status DEFAULT 'ACTIVE'::public.schedule_rule_status NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


--
-- Name: seat_holds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seat_holds (
    id uuid NOT NULL,
    flight_id uuid NOT NULL,
    seat_id uuid NOT NULL,
    user_id uuid,
    session_id character varying(255),
    status public.seat_hold_status DEFAULT 'ACTIVE'::public.seat_hold_status NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    booking_id uuid
);


--
-- Name: seats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seats (
    id uuid NOT NULL,
    aircraft_id uuid NOT NULL,
    seat_number character varying(10) NOT NULL,
    cabin_class public.cabin_class NOT NULL,
    seat_row integer,
    seat_column character varying(5),
    features jsonb,
    is_exit_row boolean DEFAULT false NOT NULL
);


--
-- Name: sessions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sessions (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    user_agent character varying(500),
    ip_address character varying(45),
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    last_used_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    revoked_at timestamp(6) with time zone,
    revoke_reason character varying(50)
);


--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_settings (
    id uuid NOT NULL,
    key character varying(100) NOT NULL,
    value text NOT NULL,
    category character varying(50) NOT NULL,
    is_public boolean DEFAULT false NOT NULL,
    description text,
    updated_at timestamp(6) with time zone NOT NULL
);


--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_roles (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100) NOT NULL,
    last_name character varying(100) NOT NULL,
    phone character varying(50),
    email_verified boolean DEFAULT false NOT NULL,
    mfa_secret character varying(255),
    mfa_enabled boolean DEFAULT false NOT NULL,
    mfa_backup_codes text,
    status public.user_status DEFAULT 'ACTIVE'::public.user_status NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    date_of_birth date
);


--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
3a97aed1-90e1-4ba9-8610-e50baef06d05	4238b1fd914015d04c5ba5e8702946f2c83501d6982a8d95182a9e1d129c0118	2026-09-24 14:47:46.49358+03	20260923154042_init	\N	\N	2026-09-24 14:47:46.278128+03	1
4124ef78-86a9-49b2-a5a5-f811f8935806	d6fab17f6913a2815121b8587382522ee60e5d2d665b9e65addbce6719fe8b09	2026-10-08 15:52:31.257082+03	20261008123353_cancellation_requests	\N	\N	2026-10-08 15:52:31.149805+03	1
3ca8a794-37f0-46fb-88d9-5a4a80fdc534	b88c6cf453e98dcff00ef93434e0075c344d5fb7ffd079587731d0deb61c4801	2026-09-24 14:47:46.527403+03	20260924090723_auth_sessions_tokens	\N	\N	2026-09-24 14:47:46.494146+03	1
d1ad23f2-eef4-4b8b-9c2b-cbd9a3a9b1d0	43c8e9c87704baac7e894ca649a32559bbd2c2390fb9c9ca40e00ecdaa2986b3	2026-09-24 15:42:23.065664+03	20260924123228_drop_user_reset_token_columns	\N	\N	2026-09-24 15:42:23.059969+03	1
cba1059a-fcbf-44eb-adc7-788cde0da99b	81a3e01ade9fef02823cab55fac4d33a5f2d9a40c1d9e4ba1352ac0fe22c9ef5	2026-09-25 01:01:26.447463+03	20260924220058_audit_query_indexes	\N	\N	2026-09-25 01:01:26.385639+03	1
c1129f2e-339d-406a-9100-8eb0ab92e0c6	c39c479b33d44f0b86ee893cdfae47cb0b26a6c8686dd9e103facd5c9a3009da	2026-10-13 14:11:20.921781+03	20261013133309_notifications_inbox_fields	\N	\N	2026-10-13 14:11:20.81862+03	1
75d8c07b-f0b5-43df-bedc-e8c337d8dfc1	5429876299ad85d084e63a70c28c9f96d90de61b4e936dd0b7d45de21d50de05	2026-09-28 14:24:27.075017+03	20260928135127_novaair_identity_cleanup	\N	\N	2026-09-28 14:24:27.03615+03	1
0ae98fa2-3547-4ef9-bb52-6bd247b474c5	e397a76064e688d8a3500f454e2623b27c14bcf62c8b34d34f284bbcab94923f	2026-09-28 14:57:02.59767+03	20260928150200_schedule_rules_flight_generation	\N	\N	2026-09-28 14:57:02.455486+03	1
a7e5559a-2468-4322-b2d6-16bbbfd82f63	03f40f389039266c8f75c29b7160ebac1b9fd19285ac4a0544e96034d6d5409a	2026-09-28 15:58:57.769064+03	20260928163000_booking_seat_holds	\N	\N	2026-09-28 15:58:57.660111+03	1
618f385f-d52f-47ff-a1b9-1832bed30e8f	2adb5295c09edadf018b1b07ad1dc4592e6ac7b20e91d98437a2946cc2ab8bdb	2026-10-13 15:12:25.637021+03	20261013151147_notifications_email_delivery	\N	\N	2026-10-13 15:12:25.59864+03	1
e8ac1bb6-5a70-4c52-8114-f03e80edddef	c3e5395ca753fdc2edc7da444928346304f05ff1b5804969fef21e66a61c75b6	2026-09-28 16:43:27.91047+03	20260928174500_offers	\N	\N	2026-09-28 16:43:27.830999+03	1
4c3a3ceb-7323-495f-9b1c-452d02a79504	9460e8114ad6cee48cdc87b0353cb6e9e50e3dcfd5585bf53b00a271f12a6a7f	2026-10-06 01:37:34.565409+03	20261006013000_booking_idempotency_updated_at	\N	\N	2026-10-06 01:37:34.565409+03	1
93719920-183f-40a0-8dfc-752a57861f6a	4760bb24247e16ccc8d40557960b13a0c0cdf86e1e39f30e80b1cf4465a6359b	2026-10-06 17:13:45.704861+03	20261005184531_user_date_of_birth	\N	\N	2026-10-06 17:13:45.68876+03	1
977d3148-bbe7-4920-a351-9da372e2ddbb	a373400e1ae6acda328c75cc42a139e27ee9eb41e08cdb7647ad9b1bd9640191	2026-10-06 17:13:45.788207+03	20261006143220_stripe_paymentintents_webhooks	\N	\N	2026-10-06 17:13:45.705516+03	1
4228db61-2cb9-438d-a634-6a0f1484c28c	7509c399a5518fa1f8d4d8da8c80db1b7682b347bcc07e59563d9e1a33149f8e	2026-10-08 00:03:31.576145+03	20261007201449_refund_operations_observability	\N	\N	2026-10-08 00:03:31.485857+03	1
bccce7aa-01c7-4be2-8c94-715986127272	11331dac14fc5ddcb50ba185ec7feb8cce161ffa11949d39c3140d804e67b164	2026-10-08 13:04:37.098358+03	20261008094004_bookable_offers	\N	\N	2026-10-08 13:04:36.998374+03	1
\.


--
-- Data for Name: aircraft; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.aircraft (id, registration, model, capacity, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: airports; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.airports (id, iata_code, icao_code, name, city, country, timezone, latitude, longitude, status) FROM stdin;
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.audit_logs (id, actor_id, actor_type, action, target_type, target_id, metadata, ip_address, created_at, booking_id) FROM stdin;
\.


--
-- Data for Name: baggage; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.baggage (id, booking_passenger_id, type, weight_kg, pieces, tag_number, status) FROM stdin;
\.


--
-- Data for Name: baggage_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.baggage_events (id, baggage_id, event_type, location, metadata, occurred_at) FROM stdin;
\.


--
-- Data for Name: boarding_passes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.boarding_passes (id, check_in_id, boarding_group, seat_number, gate, qr_code, issued_at) FROM stdin;
\.


--
-- Data for Name: booking_extras; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.booking_extras (id, booking_id, extra_service_id, quantity, price) FROM stdin;
\.


--
-- Data for Name: booking_passengers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.booking_passengers (id, booking_id, passenger_id, passenger_type) FROM stdin;
\.


--
-- Data for Name: booking_seats; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.booking_seats (id, booking_passenger_id, flight_segment_id, seat_id, seat_number) FROM stdin;
\.


--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.bookings (id, booking_reference, user_id, status, total_amount, currency, booked_at, contact_email, contact_phone, fare_rules_snapshot, idempotency_key, idempotency_request_hash, updated_at, offer_id) FROM stdin;
\.


--
-- Data for Name: cancellation_requests; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.cancellation_requests (id, booking_id, user_id, reason, status, requested_at, reviewed_at, reviewed_by, rejection_reason, refund_id, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: check_ins; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.check_ins (id, booking_passenger_id, flight_segment_id, check_in_time, status) FROM stdin;
\.


--
-- Data for Name: email_verification_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.email_verification_tokens (id, user_id, token_hash, expires_at, used_at, created_at) FROM stdin;
\.


--
-- Data for Name: extra_services; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.extra_services (id, code, name, description, price, currency, status) FROM stdin;
\.


--
-- Data for Name: fares; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.fares (id, flight_id, cabin_class, base_price, tax_amount, fee_amount, currency, available_count, fare_rules) FROM stdin;
\.


--
-- Data for Name: flight_segments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.flight_segments (id, flight_id, segment_number, origin_airport_id, destination_airport_id, departure_time, arrival_time) FROM stdin;
\.


--
-- Data for Name: flights; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.flights (id, flight_number, route_id, aircraft_id, departure_time, arrival_time, status, schedule_status, created_at, updated_at, operating_date, schedule_rule_id) FROM stdin;
\.


--
-- Data for Name: loyalty_accounts; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.loyalty_accounts (id, user_id, member_number, tier, balance, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: loyalty_transactions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.loyalty_transactions (id, loyalty_account_id, booking_id, amount, type, description, created_at) FROM stdin;
\.


--
-- Data for Name: notification_templates; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notification_templates (id, code, subject, body, channel) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.notifications (id, user_id, booking_id, template_id, channel, status, content, error, sent_at, created_at, dedupe_key, read_at, title, type, attempts, next_retry_at) FROM stdin;
\.


--
-- Data for Name: offers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.offers (id, title, description, badge, destination, offer_value, terms, image_url, status, valid_from, valid_until, created_at, updated_at, cabin_class, discount_type, discount_value, route_id) FROM stdin;
\.


--
-- Data for Name: orphan_provider_refunds; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.orphan_provider_refunds (id, provider, provider_refund_reference, payment_provider_reference, amount, currency, status, first_seen_at, last_seen_at, resolved_at, resolved_by, resolution_note, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: passengers; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.passengers (id, user_id, first_name, last_name, date_of_birth, passport_number, nationality, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at) FROM stdin;
a6088b27-f3d5-44a0-93c4-7e6c19a8995a	442eb222-d989-41ba-9b3d-0fd204c4b2a4	gggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggggg	2026-10-14 21:14:29.32+03	\N	2026-10-13 21:14:29.349+03
\.


--
-- Data for Name: payment_webhook_events; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payment_webhook_events (id, provider, event_id, event_type, status, processing_error, received_at, processed_at) FROM stdin;
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.payments (id, booking_id, amount, currency, status, provider, provider_reference, token, idempotency_key, paid_at, failed_at, created_at, updated_at, provider_status) FROM stdin;
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.permissions (id, resource, action, description) FROM stdin;
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.refresh_tokens (id, session_id, token_hash, expires_at, created_at, rotated_at, replaced_by_id) FROM stdin;
bc52f51b-5eac-4ab1-874d-1bb7d640c4f6	670b7a0c-84af-4c7c-ba60-f46fedaea7cd	bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb	2026-10-14 21:14:29.32+03	2026-10-13 21:14:29.34+03	\N	\N
\.


--
-- Data for Name: refunds; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.refunds (id, payment_id, booking_id, amount, currency, status, reason, processed_at, created_at, provider_reference, updated_at) FROM stdin;
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.role_permissions (id, role_id, permission_id) FROM stdin;
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.roles (id, name, description, is_super_admin, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: routes; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.routes (id, origin_airport_id, destination_airport_id, distance_km, duration_minutes, status) FROM stdin;
\.


--
-- Data for Name: schedule_rules; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.schedule_rules (id, route_id, aircraft_id, flight_number, departure_time_local, operating_days, effective_from, effective_to, status, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: seat_holds; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.seat_holds (id, flight_id, seat_id, user_id, session_id, status, expires_at, created_at, booking_id) FROM stdin;
\.


--
-- Data for Name: seats; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.seats (id, aircraft_id, seat_number, cabin_class, seat_row, seat_column, features, is_exit_row) FROM stdin;
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.sessions (id, user_id, user_agent, ip_address, created_at, last_used_at, expires_at, revoked_at, revoke_reason) FROM stdin;
670b7a0c-84af-4c7c-ba60-f46fedaea7cd	442eb222-d989-41ba-9b3d-0fd204c4b2a4	\N	\N	2026-10-13 21:14:29.339+03	2026-10-13 21:14:29.339+03	2026-10-14 21:14:29.32+03	\N	\N
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.system_settings (id, key, value, category, is_public, description, updated_at) FROM stdin;
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.user_roles (id, user_id, role_id) FROM stdin;
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: -
--

COPY public.users (id, email, password_hash, first_name, last_name, phone, email_verified, mfa_secret, mfa_enabled, mfa_backup_codes, status, created_at, updated_at, date_of_birth) FROM stdin;
442eb222-d989-41ba-9b3d-0fd204c4b2a4	cleanup@example.com	ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff	Clean	Up	\N	f	\N	f	\N	ACTIVE	2026-10-13 21:14:29.327+03	2026-10-13 21:14:29.327+03	\N
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: aircraft aircraft_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aircraft
    ADD CONSTRAINT aircraft_pkey PRIMARY KEY (id);


--
-- Name: airports airports_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.airports
    ADD CONSTRAINT airports_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: baggage_events baggage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.baggage_events
    ADD CONSTRAINT baggage_events_pkey PRIMARY KEY (id);


--
-- Name: baggage baggage_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.baggage
    ADD CONSTRAINT baggage_pkey PRIMARY KEY (id);


--
-- Name: boarding_passes boarding_passes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boarding_passes
    ADD CONSTRAINT boarding_passes_pkey PRIMARY KEY (id);


--
-- Name: booking_extras booking_extras_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_extras
    ADD CONSTRAINT booking_extras_pkey PRIMARY KEY (id);


--
-- Name: booking_passengers booking_passengers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_passengers
    ADD CONSTRAINT booking_passengers_pkey PRIMARY KEY (id);


--
-- Name: booking_seats booking_seats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_seats
    ADD CONSTRAINT booking_seats_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: cancellation_requests cancellation_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellation_requests
    ADD CONSTRAINT cancellation_requests_pkey PRIMARY KEY (id);


--
-- Name: check_ins check_ins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_ins
    ADD CONSTRAINT check_ins_pkey PRIMARY KEY (id);


--
-- Name: email_verification_tokens email_verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (id);


--
-- Name: extra_services extra_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.extra_services
    ADD CONSTRAINT extra_services_pkey PRIMARY KEY (id);


--
-- Name: fares fares_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fares
    ADD CONSTRAINT fares_pkey PRIMARY KEY (id);


--
-- Name: flight_segments flight_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flight_segments
    ADD CONSTRAINT flight_segments_pkey PRIMARY KEY (id);


--
-- Name: flights flights_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flights
    ADD CONSTRAINT flights_pkey PRIMARY KEY (id);


--
-- Name: loyalty_accounts loyalty_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_accounts
    ADD CONSTRAINT loyalty_accounts_pkey PRIMARY KEY (id);


--
-- Name: loyalty_transactions loyalty_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_pkey PRIMARY KEY (id);


--
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: offers offers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_pkey PRIMARY KEY (id);


--
-- Name: orphan_provider_refunds orphan_provider_refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.orphan_provider_refunds
    ADD CONSTRAINT orphan_provider_refunds_pkey PRIMARY KEY (id);


--
-- Name: passengers passengers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passengers
    ADD CONSTRAINT passengers_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: payment_webhook_events payment_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payment_webhook_events
    ADD CONSTRAINT payment_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: routes routes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_pkey PRIMARY KEY (id);


--
-- Name: schedule_rules schedule_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_rules
    ADD CONSTRAINT schedule_rules_pkey PRIMARY KEY (id);


--
-- Name: seat_holds seat_holds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seat_holds
    ADD CONSTRAINT seat_holds_pkey PRIMARY KEY (id);


--
-- Name: seats seats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seats
    ADD CONSTRAINT seats_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: aircraft_registration_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX aircraft_registration_key ON public.aircraft USING btree (registration);


--
-- Name: airports_iata_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX airports_iata_code_key ON public.airports USING btree (iata_code);


--
-- Name: audit_logs_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_action_idx ON public.audit_logs USING btree (action);


--
-- Name: audit_logs_actor_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_actor_id_idx ON public.audit_logs USING btree (actor_id);


--
-- Name: audit_logs_actor_type_action_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_actor_type_action_idx ON public.audit_logs USING btree (actor_type, action);


--
-- Name: audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at);


--
-- Name: audit_logs_target_type_target_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX audit_logs_target_type_target_id_idx ON public.audit_logs USING btree (target_type, target_id);


--
-- Name: baggage_events_baggage_id_occurred_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX baggage_events_baggage_id_occurred_at_idx ON public.baggage_events USING btree (baggage_id, occurred_at);


--
-- Name: baggage_tag_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX baggage_tag_number_key ON public.baggage USING btree (tag_number);


--
-- Name: boarding_passes_check_in_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX boarding_passes_check_in_id_key ON public.boarding_passes USING btree (check_in_id);


--
-- Name: booking_passengers_booking_id_passenger_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX booking_passengers_booking_id_passenger_id_key ON public.booking_passengers USING btree (booking_id, passenger_id);


--
-- Name: booking_seats_booking_passenger_id_flight_segment_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX booking_seats_booking_passenger_id_flight_segment_id_key ON public.booking_seats USING btree (booking_passenger_id, flight_segment_id);


--
-- Name: booking_seats_flight_segment_id_seat_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX booking_seats_flight_segment_id_seat_id_key ON public.booking_seats USING btree (flight_segment_id, seat_id);


--
-- Name: bookings_booking_reference_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bookings_booking_reference_key ON public.bookings USING btree (booking_reference);


--
-- Name: bookings_offer_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_offer_id_idx ON public.bookings USING btree (offer_id);


--
-- Name: bookings_user_id_booked_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX bookings_user_id_booked_at_idx ON public.bookings USING btree (user_id, booked_at);


--
-- Name: bookings_user_id_idempotency_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX bookings_user_id_idempotency_key_key ON public.bookings USING btree (user_id, idempotency_key);


--
-- Name: cancellation_requests_booking_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cancellation_requests_booking_id_idx ON public.cancellation_requests USING btree (booking_id);


--
-- Name: cancellation_requests_one_pending_per_booking; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX cancellation_requests_one_pending_per_booking ON public.cancellation_requests USING btree (booking_id) WHERE (status = 'PENDING'::public.cancellation_request_status);


--
-- Name: cancellation_requests_status_requested_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cancellation_requests_status_requested_at_idx ON public.cancellation_requests USING btree (status, requested_at);


--
-- Name: check_ins_booking_passenger_id_flight_segment_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX check_ins_booking_passenger_id_flight_segment_id_key ON public.check_ins USING btree (booking_passenger_id, flight_segment_id);


--
-- Name: email_verification_tokens_token_hash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX email_verification_tokens_token_hash_key ON public.email_verification_tokens USING btree (token_hash);


--
-- Name: email_verification_tokens_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX email_verification_tokens_user_id_idx ON public.email_verification_tokens USING btree (user_id);


--
-- Name: extra_services_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX extra_services_code_key ON public.extra_services USING btree (code);


--
-- Name: fares_flight_id_cabin_class_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX fares_flight_id_cabin_class_key ON public.fares USING btree (flight_id, cabin_class);


--
-- Name: flight_segments_flight_id_segment_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX flight_segments_flight_id_segment_number_key ON public.flight_segments USING btree (flight_id, segment_number);


--
-- Name: flights_departure_time_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flights_departure_time_idx ON public.flights USING btree (departure_time);


--
-- Name: flights_operating_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flights_operating_date_idx ON public.flights USING btree (operating_date);


--
-- Name: flights_schedule_rule_id_operating_date_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX flights_schedule_rule_id_operating_date_key ON public.flights USING btree (schedule_rule_id, operating_date);


--
-- Name: flights_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX flights_status_idx ON public.flights USING btree (status);


--
-- Name: loyalty_accounts_member_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX loyalty_accounts_member_number_key ON public.loyalty_accounts USING btree (member_number);


--
-- Name: loyalty_accounts_user_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX loyalty_accounts_user_id_key ON public.loyalty_accounts USING btree (user_id);


--
-- Name: notification_templates_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notification_templates_code_key ON public.notification_templates USING btree (code);


--
-- Name: notifications_booking_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_booking_id_idx ON public.notifications USING btree (booking_id);


--
-- Name: notifications_channel_status_next_retry_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_channel_status_next_retry_at_idx ON public.notifications USING btree (channel, status, next_retry_at);


--
-- Name: notifications_dedupe_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX notifications_dedupe_key_key ON public.notifications USING btree (dedupe_key);


--
-- Name: notifications_user_id_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_id_created_at_idx ON public.notifications USING btree (user_id, created_at);


--
-- Name: notifications_user_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX notifications_user_id_status_idx ON public.notifications USING btree (user_id, status);


--
-- Name: offers_status_valid_from_valid_until_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX offers_status_valid_from_valid_until_idx ON public.offers USING btree (status, valid_from, valid_until);


--
-- Name: offers_title_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX offers_title_key ON public.offers USING btree (title);


--
-- Name: orphan_provider_refunds_provider_provider_refund_reference_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX orphan_provider_refunds_provider_provider_refund_reference_key ON public.orphan_provider_refunds USING btree (provider, provider_refund_reference);


--
-- Name: orphan_provider_refunds_status_first_seen_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX orphan_provider_refunds_status_first_seen_at_idx ON public.orphan_provider_refunds USING btree (status, first_seen_at);


--
-- Name: password_reset_tokens_token_hash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX password_reset_tokens_token_hash_key ON public.password_reset_tokens USING btree (token_hash);


--
-- Name: password_reset_tokens_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX password_reset_tokens_user_id_idx ON public.password_reset_tokens USING btree (user_id);


--
-- Name: payment_webhook_events_provider_event_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payment_webhook_events_provider_event_id_key ON public.payment_webhook_events USING btree (provider, event_id);


--
-- Name: payments_booking_id_idempotency_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payments_booking_id_idempotency_key_key ON public.payments USING btree (booking_id, idempotency_key);


--
-- Name: payments_booking_id_status_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX payments_booking_id_status_idx ON public.payments USING btree (booking_id, status);


--
-- Name: payments_provider_reference_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX payments_provider_reference_key ON public.payments USING btree (provider_reference);


--
-- Name: permissions_resource_action_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX permissions_resource_action_key ON public.permissions USING btree (resource, action);


--
-- Name: refresh_tokens_session_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX refresh_tokens_session_id_idx ON public.refresh_tokens USING btree (session_id);


--
-- Name: refresh_tokens_token_hash_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX refresh_tokens_token_hash_key ON public.refresh_tokens USING btree (token_hash);


--
-- Name: refunds_booking_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX refunds_booking_id_idx ON public.refunds USING btree (booking_id);


--
-- Name: refunds_payment_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX refunds_payment_id_idx ON public.refunds USING btree (payment_id);


--
-- Name: refunds_status_created_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX refunds_status_created_at_idx ON public.refunds USING btree (status, created_at);


--
-- Name: role_permissions_role_id_permission_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX role_permissions_role_id_permission_id_key ON public.role_permissions USING btree (role_id, permission_id);


--
-- Name: roles_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX roles_name_key ON public.roles USING btree (name);


--
-- Name: routes_origin_airport_id_destination_airport_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX routes_origin_airport_id_destination_airport_id_key ON public.routes USING btree (origin_airport_id, destination_airport_id);


--
-- Name: schedule_rules_flight_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX schedule_rules_flight_number_key ON public.schedule_rules USING btree (flight_number);


--
-- Name: seat_holds_booking_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX seat_holds_booking_id_idx ON public.seat_holds USING btree (booking_id);


--
-- Name: seat_holds_flight_id_seat_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX seat_holds_flight_id_seat_id_idx ON public.seat_holds USING btree (flight_id, seat_id);


--
-- Name: seat_holds_one_active_per_flight_seat; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX seat_holds_one_active_per_flight_seat ON public.seat_holds USING btree (flight_id, seat_id) WHERE (status = 'ACTIVE'::public.seat_hold_status);


--
-- Name: seat_holds_status_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX seat_holds_status_expires_at_idx ON public.seat_holds USING btree (status, expires_at);


--
-- Name: seats_aircraft_id_seat_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX seats_aircraft_id_seat_number_key ON public.seats USING btree (aircraft_id, seat_number);


--
-- Name: sessions_expires_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_expires_at_idx ON public.sessions USING btree (expires_at);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sessions_user_id_idx ON public.sessions USING btree (user_id);


--
-- Name: system_settings_key_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX system_settings_key_key ON public.system_settings USING btree (key);


--
-- Name: user_roles_user_id_role_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_roles_user_id_role_id_key ON public.user_roles USING btree (user_id, role_id);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: baggage baggage_booking_passenger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.baggage
    ADD CONSTRAINT baggage_booking_passenger_id_fkey FOREIGN KEY (booking_passenger_id) REFERENCES public.booking_passengers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: baggage_events baggage_events_baggage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.baggage_events
    ADD CONSTRAINT baggage_events_baggage_id_fkey FOREIGN KEY (baggage_id) REFERENCES public.baggage(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: boarding_passes boarding_passes_check_in_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boarding_passes
    ADD CONSTRAINT boarding_passes_check_in_id_fkey FOREIGN KEY (check_in_id) REFERENCES public.check_ins(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: booking_extras booking_extras_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_extras
    ADD CONSTRAINT booking_extras_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: booking_extras booking_extras_extra_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_extras
    ADD CONSTRAINT booking_extras_extra_service_id_fkey FOREIGN KEY (extra_service_id) REFERENCES public.extra_services(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: booking_passengers booking_passengers_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_passengers
    ADD CONSTRAINT booking_passengers_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: booking_passengers booking_passengers_passenger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_passengers
    ADD CONSTRAINT booking_passengers_passenger_id_fkey FOREIGN KEY (passenger_id) REFERENCES public.passengers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: booking_seats booking_seats_booking_passenger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_seats
    ADD CONSTRAINT booking_seats_booking_passenger_id_fkey FOREIGN KEY (booking_passenger_id) REFERENCES public.booking_passengers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: booking_seats booking_seats_flight_segment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_seats
    ADD CONSTRAINT booking_seats_flight_segment_id_fkey FOREIGN KEY (flight_segment_id) REFERENCES public.flight_segments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: booking_seats booking_seats_seat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.booking_seats
    ADD CONSTRAINT booking_seats_seat_id_fkey FOREIGN KEY (seat_id) REFERENCES public.seats(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bookings bookings_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bookings bookings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cancellation_requests cancellation_requests_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellation_requests
    ADD CONSTRAINT cancellation_requests_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cancellation_requests cancellation_requests_refund_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellation_requests
    ADD CONSTRAINT cancellation_requests_refund_id_fkey FOREIGN KEY (refund_id) REFERENCES public.refunds(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: cancellation_requests cancellation_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cancellation_requests
    ADD CONSTRAINT cancellation_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: check_ins check_ins_booking_passenger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_ins
    ADD CONSTRAINT check_ins_booking_passenger_id_fkey FOREIGN KEY (booking_passenger_id) REFERENCES public.booking_passengers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: check_ins check_ins_flight_segment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.check_ins
    ADD CONSTRAINT check_ins_flight_segment_id_fkey FOREIGN KEY (flight_segment_id) REFERENCES public.flight_segments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: email_verification_tokens email_verification_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: fares fares_flight_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fares
    ADD CONSTRAINT fares_flight_id_fkey FOREIGN KEY (flight_id) REFERENCES public.flights(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: flight_segments flight_segments_destination_airport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flight_segments
    ADD CONSTRAINT flight_segments_destination_airport_id_fkey FOREIGN KEY (destination_airport_id) REFERENCES public.airports(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: flight_segments flight_segments_flight_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flight_segments
    ADD CONSTRAINT flight_segments_flight_id_fkey FOREIGN KEY (flight_id) REFERENCES public.flights(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: flight_segments flight_segments_origin_airport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flight_segments
    ADD CONSTRAINT flight_segments_origin_airport_id_fkey FOREIGN KEY (origin_airport_id) REFERENCES public.airports(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: flights flights_aircraft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flights
    ADD CONSTRAINT flights_aircraft_id_fkey FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: flights flights_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flights
    ADD CONSTRAINT flights_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: flights flights_schedule_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.flights
    ADD CONSTRAINT flights_schedule_rule_id_fkey FOREIGN KEY (schedule_rule_id) REFERENCES public.schedule_rules(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: loyalty_accounts loyalty_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_accounts
    ADD CONSTRAINT loyalty_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: loyalty_transactions loyalty_transactions_loyalty_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_loyalty_account_id_fkey FOREIGN KEY (loyalty_account_id) REFERENCES public.loyalty_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notifications notifications_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notifications notifications_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.notification_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: offers offers_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: passengers passengers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.passengers
    ADD CONSTRAINT passengers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: payments payments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: refunds refunds_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: refunds refunds_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: routes routes_destination_airport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_destination_airport_id_fkey FOREIGN KEY (destination_airport_id) REFERENCES public.airports(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: routes routes_origin_airport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_origin_airport_id_fkey FOREIGN KEY (origin_airport_id) REFERENCES public.airports(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: schedule_rules schedule_rules_aircraft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_rules
    ADD CONSTRAINT schedule_rules_aircraft_id_fkey FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: schedule_rules schedule_rules_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schedule_rules
    ADD CONSTRAINT schedule_rules_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: seat_holds seat_holds_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seat_holds
    ADD CONSTRAINT seat_holds_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: seat_holds seat_holds_flight_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seat_holds
    ADD CONSTRAINT seat_holds_flight_id_fkey FOREIGN KEY (flight_id) REFERENCES public.flights(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: seat_holds seat_holds_seat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seat_holds
    ADD CONSTRAINT seat_holds_seat_id_fkey FOREIGN KEY (seat_id) REFERENCES public.seats(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: seat_holds seat_holds_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seat_holds
    ADD CONSTRAINT seat_holds_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: seats seats_aircraft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seats
    ADD CONSTRAINT seats_aircraft_id_fkey FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict KkW3Z2AFFl7H3wnbyloWcCZOu98txm2sOXyBiJcyTswUSUrFQFhjquzr3W3bkgm

