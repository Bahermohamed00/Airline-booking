--
-- PostgreSQL database dump
--

\restrict KfddOq8CNpaZ1YudbUx7Xv7XK2FVGeAQ0ioQ2OHdFxPoWaWhp5UHyZJpmaoUkAH

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
-- Name: aircraft_status; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.aircraft_status AS ENUM (
    'ACTIVE',
    'MAINTENANCE',
    'RETIRED'
);


ALTER TYPE public.aircraft_status OWNER TO airline;

--
-- Name: airport_status; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.airport_status AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE public.airport_status OWNER TO airline;

--
-- Name: baggage_status; Type: TYPE; Schema: public; Owner: airline
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


ALTER TYPE public.baggage_status OWNER TO airline;

--
-- Name: baggage_type; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.baggage_type AS ENUM (
    'CARRY_ON',
    'CHECKED',
    'SPECIAL'
);


ALTER TYPE public.baggage_type OWNER TO airline;

--
-- Name: booking_status; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.booking_status AS ENUM (
    'PENDING',
    'CONFIRMED',
    'CANCELLED',
    'CHECKED_IN',
    'BOARDED',
    'NO_SHOW'
);


ALTER TYPE public.booking_status OWNER TO airline;

--
-- Name: cabin_class; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.cabin_class AS ENUM (
    'ECONOMY',
    'PREMIUM_ECONOMY',
    'BUSINESS',
    'FIRST'
);


ALTER TYPE public.cabin_class OWNER TO airline;

--
-- Name: cancellation_request_status; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.cancellation_request_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);


ALTER TYPE public.cancellation_request_status OWNER TO airline;

--
-- Name: check_in_status; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.check_in_status AS ENUM (
    'COMPLETED',
    'CANCELLED'
);


ALTER TYPE public.check_in_status OWNER TO airline;

--
-- Name: discount_type; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.discount_type AS ENUM (
    'PERCENT',
    'FIXED_AMOUNT'
);


ALTER TYPE public.discount_type OWNER TO airline;

--
-- Name: extra_service_status; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.extra_service_status AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE public.extra_service_status OWNER TO airline;

--
-- Name: flight_schedule_status; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.flight_schedule_status AS ENUM (
    'ONTIME',
    'DELAYED',
    'CANCELLED'
);


ALTER TYPE public.flight_schedule_status OWNER TO airline;

--
-- Name: flight_status; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.flight_status AS ENUM (
    'SCHEDULED',
    'ACTIVE',
    'DELAYED',
    'CANCELLED',
    'COMPLETED'
);


ALTER TYPE public.flight_status OWNER TO airline;

--
-- Name: loyalty_tier; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.loyalty_tier AS ENUM (
    'MEMBER',
    'SILVER',
    'GOLD',
    'HON_CIRCLE'
);


ALTER TYPE public.loyalty_tier OWNER TO airline;

--
-- Name: loyalty_transaction_type; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.loyalty_transaction_type AS ENUM (
    'EARN',
    'BURN',
    'ADJUSTMENT',
    'EXPIRY'
);


ALTER TYPE public.loyalty_transaction_type OWNER TO airline;

--
-- Name: notification_channel; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.notification_channel AS ENUM (
    'EMAIL',
    'SMS',
    'PUSH',
    'IN_APP'
);


ALTER TYPE public.notification_channel OWNER TO airline;

--
-- Name: notification_status; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.notification_status AS ENUM (
    'PENDING',
    'SENT',
    'DELIVERED',
    'FAILED',
    'RETRYING'
);


ALTER TYPE public.notification_status OWNER TO airline;

--
-- Name: offer_status; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.offer_status AS ENUM (
    'DRAFT',
    'ACTIVE',
    'INACTIVE',
    'EXPIRED'
);


ALTER TYPE public.offer_status OWNER TO airline;

--
-- Name: orphan_refund_status; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.orphan_refund_status AS ENUM (
    'UNMATCHED',
    'RESOLVED'
);


ALTER TYPE public.orphan_refund_status OWNER TO airline;

--
-- Name: passenger_type; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.passenger_type AS ENUM (
    'ADULT',
    'CHILD',
    'INFANT'
);


ALTER TYPE public.passenger_type OWNER TO airline;

--
-- Name: payment_status; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.payment_status AS ENUM (
    'PENDING',
    'AUTHORIZED',
    'SUCCESS',
    'FAILED',
    'REFUNDED',
    'PARTIALLY_REFUNDED'
);


ALTER TYPE public.payment_status OWNER TO airline;

--
-- Name: payment_webhook_event_status; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.payment_webhook_event_status AS ENUM (
    'RECEIVED',
    'PROCESSED',
    'FAILED',
    'IGNORED'
);


ALTER TYPE public.payment_webhook_event_status OWNER TO airline;

--
-- Name: refund_status; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.refund_status AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED',
    'PROCESSED'
);


ALTER TYPE public.refund_status OWNER TO airline;

--
-- Name: route_status; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.route_status AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE public.route_status OWNER TO airline;

--
-- Name: schedule_rule_status; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.schedule_rule_status AS ENUM (
    'ACTIVE',
    'INACTIVE'
);


ALTER TYPE public.schedule_rule_status OWNER TO airline;

--
-- Name: seat_hold_status; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.seat_hold_status AS ENUM (
    'ACTIVE',
    'EXPIRED',
    'CONVERTED',
    'RELEASED'
);


ALTER TYPE public.seat_hold_status OWNER TO airline;

--
-- Name: user_status; Type: TYPE; Schema: public; Owner: airline
--

CREATE TYPE public.user_status AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'DEACTIVATED',
    'PENDING_VERIFICATION'
);


ALTER TYPE public.user_status OWNER TO airline;

--
-- Name: weekday; Type: TYPE; Schema: public; Owner: airline
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


ALTER TYPE public.weekday OWNER TO airline;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _prisma_migrations; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public._prisma_migrations OWNER TO airline;

--
-- Name: aircraft; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.aircraft OWNER TO airline;

--
-- Name: airports; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.airports OWNER TO airline;

--
-- Name: audit_logs; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.audit_logs OWNER TO airline;

--
-- Name: baggage; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.baggage OWNER TO airline;

--
-- Name: baggage_events; Type: TABLE; Schema: public; Owner: airline
--

CREATE TABLE public.baggage_events (
    id uuid NOT NULL,
    baggage_id uuid NOT NULL,
    event_type character varying(50) NOT NULL,
    location character varying(100),
    metadata jsonb,
    occurred_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.baggage_events OWNER TO airline;

--
-- Name: boarding_passes; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.boarding_passes OWNER TO airline;

--
-- Name: booking_extras; Type: TABLE; Schema: public; Owner: airline
--

CREATE TABLE public.booking_extras (
    id uuid NOT NULL,
    booking_id uuid NOT NULL,
    extra_service_id uuid NOT NULL,
    quantity integer DEFAULT 1 NOT NULL,
    price numeric(12,2) NOT NULL
);


ALTER TABLE public.booking_extras OWNER TO airline;

--
-- Name: booking_passengers; Type: TABLE; Schema: public; Owner: airline
--

CREATE TABLE public.booking_passengers (
    id uuid NOT NULL,
    booking_id uuid NOT NULL,
    passenger_id uuid NOT NULL,
    passenger_type public.passenger_type DEFAULT 'ADULT'::public.passenger_type NOT NULL
);


ALTER TABLE public.booking_passengers OWNER TO airline;

--
-- Name: booking_seats; Type: TABLE; Schema: public; Owner: airline
--

CREATE TABLE public.booking_seats (
    id uuid NOT NULL,
    booking_passenger_id uuid NOT NULL,
    flight_segment_id uuid NOT NULL,
    seat_id uuid NOT NULL,
    seat_number character varying(10) NOT NULL
);


ALTER TABLE public.booking_seats OWNER TO airline;

--
-- Name: bookings; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.bookings OWNER TO airline;

--
-- Name: cancellation_requests; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.cancellation_requests OWNER TO airline;

--
-- Name: check_ins; Type: TABLE; Schema: public; Owner: airline
--

CREATE TABLE public.check_ins (
    id uuid NOT NULL,
    booking_passenger_id uuid NOT NULL,
    flight_segment_id uuid NOT NULL,
    check_in_time timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status public.check_in_status DEFAULT 'COMPLETED'::public.check_in_status NOT NULL
);


ALTER TABLE public.check_ins OWNER TO airline;

--
-- Name: email_verification_tokens; Type: TABLE; Schema: public; Owner: airline
--

CREATE TABLE public.email_verification_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    used_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.email_verification_tokens OWNER TO airline;

--
-- Name: extra_services; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.extra_services OWNER TO airline;

--
-- Name: fares; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.fares OWNER TO airline;

--
-- Name: flight_segments; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.flight_segments OWNER TO airline;

--
-- Name: flights; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.flights OWNER TO airline;

--
-- Name: loyalty_accounts; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.loyalty_accounts OWNER TO airline;

--
-- Name: loyalty_transactions; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.loyalty_transactions OWNER TO airline;

--
-- Name: notification_templates; Type: TABLE; Schema: public; Owner: airline
--

CREATE TABLE public.notification_templates (
    id uuid NOT NULL,
    code character varying(50) NOT NULL,
    subject character varying(255),
    body text NOT NULL,
    channel public.notification_channel DEFAULT 'EMAIL'::public.notification_channel NOT NULL
);


ALTER TABLE public.notification_templates OWNER TO airline;

--
-- Name: notifications; Type: TABLE; Schema: public; Owner: airline
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
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.notifications OWNER TO airline;

--
-- Name: offers; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.offers OWNER TO airline;

--
-- Name: orphan_provider_refunds; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.orphan_provider_refunds OWNER TO airline;

--
-- Name: passengers; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.passengers OWNER TO airline;

--
-- Name: password_reset_tokens; Type: TABLE; Schema: public; Owner: airline
--

CREATE TABLE public.password_reset_tokens (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    used_at timestamp(6) with time zone,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


ALTER TABLE public.password_reset_tokens OWNER TO airline;

--
-- Name: payment_webhook_events; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.payment_webhook_events OWNER TO airline;

--
-- Name: payments; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.payments OWNER TO airline;

--
-- Name: permissions; Type: TABLE; Schema: public; Owner: airline
--

CREATE TABLE public.permissions (
    id uuid NOT NULL,
    resource character varying(100) NOT NULL,
    action character varying(100) NOT NULL,
    description text
);


ALTER TABLE public.permissions OWNER TO airline;

--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.refresh_tokens OWNER TO airline;

--
-- Name: refunds; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.refunds OWNER TO airline;

--
-- Name: role_permissions; Type: TABLE; Schema: public; Owner: airline
--

CREATE TABLE public.role_permissions (
    id uuid NOT NULL,
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL
);


ALTER TABLE public.role_permissions OWNER TO airline;

--
-- Name: roles; Type: TABLE; Schema: public; Owner: airline
--

CREATE TABLE public.roles (
    id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_super_admin boolean DEFAULT false NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL
);


ALTER TABLE public.roles OWNER TO airline;

--
-- Name: routes; Type: TABLE; Schema: public; Owner: airline
--

CREATE TABLE public.routes (
    id uuid NOT NULL,
    origin_airport_id uuid NOT NULL,
    destination_airport_id uuid NOT NULL,
    distance_km integer,
    duration_minutes integer,
    status public.route_status DEFAULT 'ACTIVE'::public.route_status NOT NULL
);


ALTER TABLE public.routes OWNER TO airline;

--
-- Name: schedule_rules; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.schedule_rules OWNER TO airline;

--
-- Name: seat_holds; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.seat_holds OWNER TO airline;

--
-- Name: seats; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.seats OWNER TO airline;

--
-- Name: sessions; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.sessions OWNER TO airline;

--
-- Name: system_settings; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.system_settings OWNER TO airline;

--
-- Name: user_roles; Type: TABLE; Schema: public; Owner: airline
--

CREATE TABLE public.user_roles (
    id uuid NOT NULL,
    user_id uuid NOT NULL,
    role_id uuid NOT NULL
);


ALTER TABLE public.user_roles OWNER TO airline;

--
-- Name: users; Type: TABLE; Schema: public; Owner: airline
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


ALTER TABLE public.users OWNER TO airline;

--
-- Data for Name: _prisma_migrations; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public._prisma_migrations (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count) FROM stdin;
35af6403-96c5-4c07-a527-c2077451368d	4238b1fd914015d04c5ba5e8702946f2c83501d6982a8d95182a9e1d129c0118	2026-09-23 21:36:57.820018+03	20260923154042_init	\N	\N	2026-09-23 21:36:54.130974+03	1
613afb39-43d5-4310-ba27-4baa3460359c	b88c6cf453e98dcff00ef93434e0075c344d5fb7ffd079587731d0deb61c4801	2026-09-24 12:07:23.794652+03	20260924090723_auth_sessions_tokens	\N	\N	2026-09-24 12:07:23.686696+03	1
7187d077-4cb9-44ce-970a-c7391abb520a	11331dac14fc5ddcb50ba185ec7feb8cce161ffa11949d39c3140d804e67b164	\N	20261008094004_bookable_offers	A migration failed to apply. New migrations cannot be applied before the error is recovered from. Read more about how to resolve migration issues in a production database: https://pris.ly/d/migrate-resolve\n\nMigration name: 20261008094004_bookable_offers\n\nDatabase error code: 42710\n\nDatabase error:\nERROR: type "discount_type" already exists\n\nDbError { severity: "ERROR", parsed_severity: Some(Error), code: SqlState(E42710), message: "type \\"discount_type\\" already exists", detail: None, hint: None, position: None, where_: None, schema: None, table: None, column: None, datatype: None, constraint: None, file: Some("typecmds.c"), line: Some(1221), routine: Some("DefineEnum") }\n\n   0: sql_schema_connector::apply_migration::apply_script\n           with migration_name="20261008094004_bookable_offers"\n             at schema-engine\\connectors\\sql-schema-connector\\src\\apply_migration.rs:113\n   1: schema_commands::commands::apply_migrations::Applying migration\n           with migration_name="20261008094004_bookable_offers"\n             at schema-engine\\commands\\src\\commands\\apply_migrations.rs:95\n   2: schema_core::state::ApplyMigrations\n             at schema-engine\\core\\src\\state.rs:260	2026-10-08 12:44:57.831555+03	2026-10-08 12:44:14.169713+03	0
860d6615-3917-4626-9cfb-e1eb212dda74	43c8e9c87704baac7e894ca649a32559bbd2c2390fb9c9ca40e00ecdaa2986b3	2026-09-24 15:32:59.135479+03	20260924123228_drop_user_reset_token_columns	\N	\N	2026-09-24 15:32:57.59536+03	1
ee1d723a-6abf-401e-8026-efd757b80f24	11331dac14fc5ddcb50ba185ec7feb8cce161ffa11949d39c3140d804e67b164	2026-10-08 12:44:57.833195+03	20261008094004_bookable_offers		\N	2026-10-08 12:44:57.833195+03	0
9a18e97d-56b9-4ca4-8b88-81cfec33a71f	81a3e01ade9fef02823cab55fac4d33a5f2d9a40c1d9e4ba1352ac0fe22c9ef5	2026-09-25 01:01:21.215277+03	20260924220058_audit_query_indexes	\N	\N	2026-09-25 01:01:21.171115+03	1
519f468a-1a18-4d4e-ae5f-cd3c52d7b01d	5429876299ad85d084e63a70c28c9f96d90de61b4e936dd0b7d45de21d50de05	2026-09-28 13:53:34.358495+03	20260928135127_novaair_identity_cleanup	\N	\N	2026-09-28 13:53:34.322649+03	1
d3f6f44c-dcee-4c98-87ff-e60a14776e79	e397a76064e688d8a3500f454e2623b27c14bcf62c8b34d34f284bbcab94923f	2026-09-28 14:56:42.664118+03	20260928150200_schedule_rules_flight_generation	\N	\N	2026-09-28 14:56:42.556844+03	1
5890e414-6749-4fb7-a4b4-4ec392831858	d6fab17f6913a2815121b8587382522ee60e5d2d665b9e65addbce6719fe8b09	2026-10-08 15:34:33.194029+03	20261008123353_cancellation_requests	\N	\N	2026-10-08 15:34:33.098564+03	1
d28ed5f6-b3d0-4faf-bc05-483f1d00dfa0	03f40f389039266c8f75c29b7160ebac1b9fd19285ac4a0544e96034d6d5409a	2026-09-28 15:58:53.401108+03	20260928163000_booking_seat_holds	\N	\N	2026-09-28 15:58:53.362724+03	1
121aab59-2d5c-4708-ad3f-988fe731cb70	c3e5395ca753fdc2edc7da444928346304f05ff1b5804969fef21e66a61c75b6	2026-09-28 16:43:24.651948+03	20260928174500_offers	\N	\N	2026-09-28 16:43:24.582246+03	1
ec3b08b5-1be1-4bdb-961d-d40755bdf657	9460e8114ad6cee48cdc87b0353cb6e9e50e3dcfd5585bf53b00a271f12a6a7f	2026-10-06 01:37:34.423572+03	20261006013000_booking_idempotency_updated_at	\N	\N	2026-10-06 01:37:34.423572+03	1
c5cad7d8-7bf9-48cc-aec7-2a3f15266485	4760bb24247e16ccc8d40557960b13a0c0cdf86e1e39f30e80b1cf4465a6359b	2026-10-06 14:14:07.304029+03	20261005184531_user_date_of_birth	\N	\N	2026-10-06 14:14:07.289274+03	1
3f6b9779-da05-48b3-8c4b-f900ab1f92ac	a373400e1ae6acda328c75cc42a139e27ee9eb41e08cdb7647ad9b1bd9640191	2026-10-06 14:33:06.259055+03	20261006143220_stripe_paymentintents_webhooks	\N	\N	2026-10-06 14:33:06.162984+03	1
d8e1e31a-bfda-4670-808a-0b6a3094638c	7509c399a5518fa1f8d4d8da8c80db1b7682b347bcc07e59563d9e1a33149f8e	2026-10-07 23:15:19.879327+03	20261007201449_refund_operations_observability	\N	\N	2026-10-07 23:15:19.631972+03	1
\.


--
-- Data for Name: aircraft; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.aircraft (id, registration, model, capacity, status, created_at, updated_at) FROM stdin;
a3e2f7af-97f8-4652-a343-3a7e72b6fb78	NV-320A	Airbus A320-200	180	ACTIVE	2026-09-30 12:51:12.124+03	2026-09-30 12:51:12.124+03
a21552b8-ad8c-4320-ad0b-dbfb73948ae2	NV-321B	Airbus A321-200	220	ACTIVE	2026-09-30 12:51:12.136+03	2026-09-30 12:51:12.136+03
b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	NV-748X	Boeing 747-8	364	ACTIVE	2026-09-30 12:51:12.138+03	2026-09-30 12:51:12.138+03
a5c588e1-b27d-4401-a431-f3d9a95e3bac	NV-359Y	Airbus A350-900	319	ACTIVE	2026-09-30 12:51:12.14+03	2026-09-30 12:51:12.14+03
\.


--
-- Data for Name: airports; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.airports (id, iata_code, icao_code, name, city, country, timezone, latitude, longitude, status) FROM stdin;
56f760aa-9f77-40da-9880-581624191508	FRA	EDDF	Frankfurt Airport	Frankfurt	Germany	Europe/Berlin	50.03790000	8.56220000	ACTIVE
a5300691-8411-4381-8b35-b731e16872de	MUC	EDDM	Munich Airport	Munich	Germany	Europe/Berlin	48.35380000	11.78610000	ACTIVE
dfaf5872-2099-4b98-aa3c-7524d411ea69	HAM	EDDH	Hamburg Airport	Hamburg	Germany	Europe/Berlin	53.63040000	9.98820000	ACTIVE
2e7ffc07-e7e3-4a34-8495-041f54670d58	LHR	EGLL	Heathrow Airport	London	United Kingdom	Europe/London	51.47000000	-0.46140000	ACTIVE
739a55a1-a38b-41e3-8f3e-348a582fcf88	JFK	KJFK	John F. Kennedy International Airport	New York	United States	America/New_York	40.64130000	-73.77810000	ACTIVE
07d67ec0-2efa-4485-b74d-f5156273330b	LAX	KLAX	Los Angeles International Airport	Los Angeles	United States	America/Los_Angeles	33.94160000	-118.40850000	ACTIVE
c2fecbff-abee-4266-988b-5e6baab68df3	CDG	LFPG	Charles de Gaulle Airport	Paris	France	Europe/Paris	49.00970000	2.54790000	ACTIVE
a5bd232c-ae03-4955-ab57-bc31296df060	AMS	EHAM	Amsterdam Airport Schiphol	Amsterdam	Netherlands	Europe/Amsterdam	52.31050000	4.76830000	ACTIVE
7c3a41dc-73a3-417a-bab7-2ee5f06daacd	SIN	WSSS	Singapore Changi Airport	Singapore	Singapore	Asia/Singapore	1.36440000	103.99150000	ACTIVE
d6b7a579-13a1-47d6-8451-720197c108b7	DXB	OMDB	Dubai International Airport	Dubai	United Arab Emirates	Asia/Dubai	25.25320000	55.36570000	ACTIVE
\.


--
-- Data for Name: audit_logs; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.audit_logs (id, actor_id, actor_type, action, target_type, target_id, metadata, ip_address, created_at, booking_id) FROM stdin;
352eb273-6caa-404d-8866-e6a7db6ae9de	9fd0f96e-5cbb-4857-87f8-66c1cafb2ceb	User	USER_REGISTERED	User	9fd0f96e-5cbb-4857-87f8-66c1cafb2ceb	\N	\N	2026-09-30 11:58:48.467+03	\N
42f0cab9-c70d-41e0-8c31-8baa0dfcedde	9fd0f96e-5cbb-4857-87f8-66c1cafb2ceb	User	USER_LOGGED_IN	User	9fd0f96e-5cbb-4857-87f8-66c1cafb2ceb	\N	::ffff:127.0.0.1	2026-09-30 11:58:48.537+03	\N
20f37a56-06e0-4cbd-b455-042714830548	\N	User	LOGIN_FAILED	User	\N	{"email": "poyavip746@abowned.com"}	::1	2026-09-30 12:07:42.881+03	\N
6891a69e-9ba0-4d3a-ace6-050d165e3359	\N	User	LOGIN_FAILED	User	\N	{"email": "poyavip746@abowned.com"}	::1	2026-09-30 12:08:23.797+03	\N
640654ba-361e-4e25-8489-f6f42e0b776d	\N	User	LOGIN_FAILED	User	\N	{"email": "poyavip746@abowned.com"}	::1	2026-09-30 12:10:16.901+03	\N
2de91fa1-de99-45dd-bcbe-43f73b1014c1	\N	User	LOGIN_FAILED	User	\N	{"email": "poyavip746@abowned.com"}	::1	2026-09-30 12:10:17.476+03	\N
456a066b-8570-456b-ad90-ee4f0e8094ae	\N	User	LOGIN_FAILED	User	\N	{"email": "poyavip746@abowned.com"}	::1	2026-09-30 12:10:26.584+03	\N
90d8bb0c-9a8f-4d38-91c8-a855190a9d78	\N	User	LOGIN_FAILED	User	\N	{"email": "poyavip746@abowned.com"}	::1	2026-09-30 12:11:12.253+03	\N
6e71aee1-1c42-48e8-a6bb-f2b2d442ed6d	\N	User	LOGIN_FAILED	User	\N	{"email": "povojed246@aminavin.com"}	::1	2026-09-30 12:11:41.605+03	\N
1aa224da-3f88-499b-8836-9c650d97c3ef	\N	User	LOGIN_FAILED	User	\N	{"email": "povojed246@aminavin.com"}	::1	2026-09-30 12:14:25.947+03	\N
5685877f-16bb-4094-a5d2-d1cbbd792fe2	\N	User	LOGIN_FAILED	User	\N	{"email": "povojed246@aminavin.com"}	::1	2026-09-30 12:15:54.506+03	\N
ab04b3ea-0826-434b-ba6f-403925f1bc78	\N	User	LOGIN_FAILED	User	\N	{"email": "povojed246@aminavin.com"}	::1	2026-09-30 12:15:55.112+03	\N
0a8a85f0-df0f-48ee-b1dd-87273ed3eec1	\N	User	LOGIN_FAILED	User	\N	{"email": "poyavip746@abowned.com"}	::1	2026-09-30 12:16:37.18+03	\N
c6bc8625-9706-48bc-bfb9-fd0842b7cd2a	\N	User	LOGIN_FAILED	User	\N	{"email": "povojed246@aminavin.com"}	::1	2026-09-30 12:16:48.075+03	\N
f6eb3cbb-9989-4a2c-b1e3-a10d072f0aa0	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_REGISTERED	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	\N	2026-09-30 12:18:58.564+03	\N
1bc13f22-2920-42eb-8ca2-2ee5cffe970b	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	EMAIL_VERIFIED	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-09-30 12:19:08.532+03	\N
83856b45-d3f9-4253-abfe-7d027e836580	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-09-30 12:19:18.825+03	\N
256b2ac3-f224-4f6b-b65f-65f367a068cd	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	7d87191a-007b-4164-832d-378feab3833d	\N	\N	2026-09-30 12:19:38.569+03	\N
94181672-b6b0-4cb2-9555-5398c0ad0d00	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-09-30 12:19:58.65+03	\N
7f0f3142-2c26-4eb9-a608-c22e691c08c2	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	305dedb8-5a5b-411e-bd3b-0f271efc530f	\N	\N	2026-09-30 12:31:41.652+03	\N
64525c5e-86b9-4bef-8a30-4137471f9ef7	\N	User	LOGIN_FAILED	User	\N	{"email": "admin@airline.local"}	::1	2026-09-30 12:31:58.867+03	\N
fb99232e-5afb-4b0d-ab1a-7fb7528b353a	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-09-30 12:49:10.065+03	\N
e33f45b4-6aa9-4c09-b324-2bee2ecec82d	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	c478e950-f69b-4a1d-8e8e-d918e66d5048	\N	\N	2026-09-30 12:49:36.775+03	\N
26f3ea18-3ef1-4e8e-ae5e-921d8d7ed711	\N	User	LOGIN_FAILED	User	\N	{"email": "admin@airline.local"}	::1	2026-09-30 12:49:45.603+03	\N
dc13ac9f-bc4d-4482-8a5f-bb924942b2e2	\N	User	LOGIN_FAILED	User	\N	{"email": "admin@airline.local"}	::1	2026-09-30 12:49:48.619+03	\N
9e84bb4c-a013-4d70-a2d1-eb1a70af7696	\N	User	LOGIN_FAILED	User	\N	{"email": "admin@airline.local"}	::1	2026-09-30 12:50:39.923+03	\N
4d190d24-6c88-400e-8ab9-5d7e0ad7abd9	\N	User	LOGIN_FAILED	User	\N	{"email": "admin@airline.local"}	::1	2026-09-30 12:50:45.055+03	\N
d91b12bb-25e8-44c2-9a1e-3a23f6992878	\N	User	LOGIN_FAILED	User	\N	{"email": "admin@airline.local"}	::1	2026-09-30 12:50:45.676+03	\N
bc09805f-d775-4d24-b8f9-ffc802817e6f	\N	User	LOGIN_FAILED	User	\N	{"email": "admin@airline.local"}	::1	2026-09-30 12:50:52.658+03	\N
f22a5396-1b5c-410d-b219-dea868bb3054	\N	User	LOGIN_FAILED	User	\N	{"email": "admin@airline.local"}	::1	2026-09-30 12:51:00.403+03	\N
012440e4-29e9-4fe7-aafb-3c3c222fe92c	\N	Guest	AUTH_RATE_LIMITED	Endpoint	POST /api/auth/login	\N	::1	2026-09-30 12:51:17.454+03	\N
60d5a5c7-a8ac-48d4-9a92-b90b71de4f0c	\N	Guest	AUTH_RATE_LIMITED	Endpoint	POST /api/auth/login	\N	::1	2026-09-30 12:51:18.167+03	\N
39680a92-d76b-4614-9fed-cb8a49b9bfd5	\N	Guest	AUTH_RATE_LIMITED	Endpoint	POST /api/auth/login	\N	::1	2026-09-30 12:51:30.011+03	\N
3b23f839-808e-451e-afc9-b82a7b90f132	\N	Guest	AUTH_RATE_LIMITED	Endpoint	POST /api/auth/login	\N	::1	2026-09-30 12:51:30.483+03	\N
7b450f50-f21c-44f7-81a0-410337a96941	\N	Guest	AUTH_RATE_LIMITED	Endpoint	POST /api/auth/login	\N	::1	2026-09-30 12:51:36.432+03	\N
181908f2-7226-4779-b143-10b9ee6bed57	\N	Guest	AUTH_RATE_LIMITED	Endpoint	POST /api/auth/login	\N	::1	2026-09-30 12:51:39.533+03	\N
3014eea9-7823-48bc-b004-c8b1e7c4875b	\N	Guest	AUTH_RATE_LIMITED	Endpoint	POST /api/auth/login	\N	::1	2026-09-30 12:51:40.457+03	\N
c57972da-261c-4c89-8fc8-127a27f0f398	\N	Guest	AUTH_RATE_LIMITED	Endpoint	POST /api/auth/login	\N	::1	2026-09-30 12:51:47.217+03	\N
0a38a298-0791-45cb-986a-d107ea248837	\N	Guest	AUTH_RATE_LIMITED	Endpoint	POST /api/auth/login	\N	::1	2026-09-30 12:51:52.8+03	\N
4b10255a-6b4f-4e76-97f8-40946c20c63e	\N	Guest	AUTH_RATE_LIMITED	Endpoint	POST /api/auth/login	\N	::1	2026-09-30 12:51:57.447+03	\N
8560fb55-93c4-4b0c-94a8-00ccca725b4a	\N	Guest	AUTH_RATE_LIMITED	Endpoint	POST /api/auth/login	\N	::1	2026-09-30 12:51:57.983+03	\N
2303ee0a-7b75-4ac0-b5a6-1f36b9371598	\N	Guest	AUTH_RATE_LIMITED	Endpoint	POST /api/auth/login	\N	::1	2026-09-30 12:52:03.666+03	\N
239687a3-da17-4951-9050-95ee17dc08cf	\N	Guest	AUTH_RATE_LIMITED	Endpoint	POST /api/auth/login	\N	::1	2026-09-30 12:52:04.089+03	\N
95f4b1ad-fee5-4185-b51e-0e3207760a8a	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-09-30 12:52:30.219+03	\N
21a42b86-a916-447d-8bdc-8f7063a4527f	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Staff	OFFER_UPDATED	Offer	32cbb37d-3afd-4008-8895-c2642958e062	{"title": "Transatlantic Business"}	\N	2026-09-30 12:52:54.922+03	\N
cd660549-f00d-4ca7-8102-b0912cc0e68c	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-09-30 12:52:56.105+03	\N
dbd085ad-3aa1-4bd0-b0b6-4ec5c1fe008e	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	02287488-01c4-4867-98b8-cf8147328de1	\N	\N	2026-09-30 12:54:36.668+03	\N
7d3b5b4c-555b-47b8-a596-0028c73a03c3	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-09-30 12:54:50.101+03	\N
4e1bc155-c09b-48bf-a948-767fd17641e7	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	90f7c85e-d8f2-48e3-9203-343dc50d0389	\N	\N	2026-09-30 12:56:17.563+03	\N
f8969d94-5d18-43f4-9a29-e3c1639ee651	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-09-30 22:12:05.576+03	\N
08b187ab-bfb6-4464-a374-cc32c2738a8e	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	BOOKING_CREATED	Booking	ab28ceb3-4cc4-4fef-8046-422df882e775	{"flightNumber": "NV202", "bookingReference": "NVEVEPXM"}	\N	2026-09-30 22:15:32.438+03	ab28ceb3-4cc4-4fef-8046-422df882e775
e2b8b48d-77ae-42a0-bd10-77213e768394	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	SEAT_HELD	Booking	ab28ceb3-4cc4-4fef-8046-422df882e775	{"holdCount": 1, "seatNumbers": ["1A"], "flightNumber": "NV202", "bookingReference": "NVEVEPXM"}	\N	2026-09-30 22:15:32.442+03	ab28ceb3-4cc4-4fef-8046-422df882e775
c1c3ddf1-7ca0-497b-af95-a8070335e4e1	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-09-30 22:16:34.762+03	\N
e0a0c9ee-eca1-4b85-a100-320e8fbc5e96	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	PAYMENT_SUCCEEDED	Payment	a06a2793-f5c8-4afe-8119-e0b12bb5964f	{"amount": 127, "currency": "EUR", "paymentId": "a06a2793-f5c8-4afe-8119-e0b12bb5964f", "bookingReference": "NVEVEPXM", "providerReference": "mockpay_642bfc03-d40f-4f6c-8070-11d34b7018a9"}	\N	2026-09-30 22:17:28.261+03	ab28ceb3-4cc4-4fef-8046-422df882e775
814478b2-64bd-4538-a3cb-80192af027dd	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	BOOKING_CONFIRMED	Booking	ab28ceb3-4cc4-4fef-8046-422df882e775	{"amount": 127, "currency": "EUR", "bookingReference": "NVEVEPXM"}	\N	2026-09-30 22:17:28.263+03	ab28ceb3-4cc4-4fef-8046-422df882e775
060ced62-98a3-4287-ad11-4decf82fa763	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-06 12:58:27.534+03	\N
6e70734f-5adc-482d-b648-63b02a0767d0	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	SEAT_HOLD_CONVERTED	Booking	ab28ceb3-4cc4-4fef-8046-422df882e775	{"holdCount": 1, "seatNumbers": ["1A"], "bookingReference": "NVEVEPXM"}	\N	2026-09-30 22:17:28.264+03	ab28ceb3-4cc4-4fef-8046-422df882e775
0283cb5a-2929-45c2-8c88-2b50e1150d03	\N	System	SEAT_HOLD_EXPIRED	SeatHold	\N	{"holdCount": 1}	\N	2026-10-01 16:14:00.639+03	\N
e6877e3f-fb0e-4d1a-a21d-3d945564e4b3	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	8f404678-b8dd-4562-8f92-46c0920b8b60	\N	\N	2026-10-01 16:16:19.767+03	\N
723fcd1b-7a6c-438f-b453-fa054f94ed16	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-01 16:16:39.857+03	\N
af9b56a9-a191-44b8-ba3e-564beee2ddfa	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	596e8fe1-f91e-45a0-9ff6-4eb7e3391d7a	\N	\N	2026-10-05 15:10:23.761+03	\N
b34b4f32-3000-46e4-96a3-0419b19464c9	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-05 15:10:43.943+03	\N
06934b93-8384-436b-a99c-edf1a0605f7f	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	6f81a2f0-84e6-47b0-b79a-900a993a32ca	\N	\N	2026-10-05 16:07:11.999+03	\N
23729059-5960-4ff4-bc4c-6b07b98a4ecb	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-05 16:07:27.568+03	\N
e5bc278b-034b-49b4-920c-97dbe346f02b	\N	System	BOOKING_CANCELLED	Booking	90886c87-c794-4803-ab23-402563190062	{"reason": "Seat holds expired before payment — cancelled automatically", "bookingReference": "NVPEND01"}	\N	2026-10-05 18:01:00.148+03	90886c87-c794-4803-ab23-402563190062
43aa5d37-e451-4af1-af17-5a2fc12b1228	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	df501df1-473f-4aa9-90f3-42fcb269898c	\N	\N	2026-10-05 18:02:58.414+03	\N
7e0a7ec0-794e-448c-9b82-f5ed1a619edc	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-05 18:03:15.946+03	\N
b9a157ff-3e80-495d-8015-eaadb5237dcc	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	c87a364b-8839-45b3-a3d3-ae4fd08c417d	\N	\N	2026-10-05 18:03:30.356+03	\N
a6570d64-f0a0-42f5-a0e7-068a5e9d83a3	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-05 18:03:41.148+03	\N
3d32a6e8-096c-4206-93ce-75f844b1e3f5	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	39597aba-f006-4143-b674-d749d9147a99	\N	\N	2026-10-05 18:03:41.169+03	\N
c63576b4-e934-4591-b14c-5880d2d38de9	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-05 18:03:43.85+03	\N
2ca23e5d-188f-4a30-bc08-c12f51b9f267	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	197173e9-fac5-4815-91b8-71bf752564d3	\N	\N	2026-10-05 18:25:39.092+03	\N
1fff3650-fe9b-4e19-a02a-5269fa66826c	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-05 18:25:47.857+03	\N
1d870012-c875-4072-a903-5c5607338cc7	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	BOOKING_CREATED	Booking	13c5bbe6-f2d3-4be3-9acb-8b20e896867b	{"flightNumber": "NV100", "bookingReference": "NVHHMPRK"}	\N	2026-10-05 18:27:04.962+03	13c5bbe6-f2d3-4be3-9acb-8b20e896867b
57150f05-2cb4-48ca-955d-667a4c682822	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	SEAT_HELD	Booking	13c5bbe6-f2d3-4be3-9acb-8b20e896867b	{"holdCount": 1, "seatNumbers": ["1A"], "flightNumber": "NV100", "bookingReference": "NVHHMPRK"}	\N	2026-10-05 18:27:04.965+03	13c5bbe6-f2d3-4be3-9acb-8b20e896867b
3eb4725a-736d-45d8-aa04-76a24615b875	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	23ad2653-6f2b-49f8-acc9-1a0f0c5af0ce	\N	\N	2026-10-05 18:27:22.291+03	\N
3332e21c-6288-442b-b0f7-5dfce3282110	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-05 18:27:35.983+03	\N
3461be9f-4c5e-4bc0-9672-78edd0fd59e3	\N	System	SEAT_HOLD_EXPIRED	SeatHold	\N	{"holdCount": 1}	\N	2026-10-05 18:43:00.063+03	\N
ab545498-f65c-4fec-8588-1a15e5f860fc	\N	System	BOOKING_CANCELLED	Booking	13c5bbe6-f2d3-4be3-9acb-8b20e896867b	{"reason": "Seat holds expired before payment — cancelled automatically", "bookingReference": "NVHHMPRK"}	\N	2026-10-05 18:43:00.066+03	13c5bbe6-f2d3-4be3-9acb-8b20e896867b
1397ff57-6a0e-4772-bf33-eacec72c3859	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	5ed9f33f-5d59-4a2a-9b5d-b801c1d45d18	\N	\N	2026-10-05 19:14:39.451+03	\N
11598ee7-e0ed-429c-b441-d62006995fb5	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-05 19:14:51.187+03	\N
3c5b1350-3df1-419d-ad01-deb82e2a4a63	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	BOOKING_CREATED	Booking	8a4fb707-cd06-4b81-858f-68c678d43a8d	{"flightNumber": "NV100", "bookingReference": "NVD3Z53P"}	\N	2026-10-05 19:16:33.346+03	8a4fb707-cd06-4b81-858f-68c678d43a8d
5f3ae30c-f641-424c-8d46-1fd41efc38ab	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	SEAT_HELD	Booking	8a4fb707-cd06-4b81-858f-68c678d43a8d	{"holdCount": 1, "seatNumbers": ["1A"], "flightNumber": "NV100", "bookingReference": "NVD3Z53P"}	\N	2026-10-05 19:16:33.349+03	8a4fb707-cd06-4b81-858f-68c678d43a8d
3cb74503-9ae6-485c-89e2-9a2f1b6ee5ac	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	PAYMENT_SUCCEEDED	Payment	64e6c1ee-3026-4c64-ab91-7dd1675ea11e	{"amount": 2780, "currency": "EUR", "paymentId": "64e6c1ee-3026-4c64-ab91-7dd1675ea11e", "bookingReference": "NVD3Z53P", "providerReference": "mockpay_efa52c39-4dca-40a4-8a7a-058f07a91cc6"}	\N	2026-10-05 19:16:38.113+03	8a4fb707-cd06-4b81-858f-68c678d43a8d
bb55416e-c259-48b1-83d2-9de73f71b04d	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	BOOKING_CONFIRMED	Booking	8a4fb707-cd06-4b81-858f-68c678d43a8d	{"amount": 2780, "currency": "EUR", "bookingReference": "NVD3Z53P"}	\N	2026-10-05 19:16:38.114+03	8a4fb707-cd06-4b81-858f-68c678d43a8d
ee83b16b-f891-4474-9dd3-1d0660cd568a	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	SEAT_HOLD_CONVERTED	Booking	8a4fb707-cd06-4b81-858f-68c678d43a8d	{"holdCount": 1, "seatNumbers": ["1A"], "bookingReference": "NVD3Z53P"}	\N	2026-10-05 19:16:38.115+03	8a4fb707-cd06-4b81-858f-68c678d43a8d
687676a6-3c10-4aa0-b3ce-c7b0f2a94bca	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	8a1a1b9c-b655-4c1d-8af3-635f41c87e69	\N	\N	2026-10-05 19:17:52.245+03	\N
76b7737a-d246-4039-aa56-d9da5a86c1f8	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-05 19:18:13.99+03	\N
31a2f0c0-416b-4171-a217-05f2d071e30b	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	00c39fcd-675f-4b75-805a-835cf0aabcb6	\N	\N	2026-10-06 02:00:55.566+03	\N
5fe0a259-a56b-4aa8-8049-fa880f7fa743	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-06 02:01:03.852+03	\N
9ad0b5a1-b6ab-4138-9d54-34f7152e71f6	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	BOOKING_CREATED	Booking	31f0228f-002b-4a71-9335-e5845c66538b	{"flightNumber": "NV202", "bookingReference": "NVU3RJGD"}	\N	2026-10-06 02:02:35.65+03	31f0228f-002b-4a71-9335-e5845c66538b
555bf8e2-40f9-4954-a3c2-9ec0ca77b6fe	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	SEAT_HELD	Booking	31f0228f-002b-4a71-9335-e5845c66538b	{"holdCount": 1, "seatNumbers": ["1A"], "flightNumber": "NV202", "bookingReference": "NVU3RJGD"}	\N	2026-10-06 02:02:35.654+03	31f0228f-002b-4a71-9335-e5845c66538b
905f30aa-5a59-40e7-acea-c4a8cb710f9b	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	PAYMENT_SUCCEEDED	Payment	0e3bd9c8-c42a-4205-84d8-56ac6890c9b5	{"amount": 127, "currency": "EUR", "paymentId": "0e3bd9c8-c42a-4205-84d8-56ac6890c9b5", "bookingReference": "NVU3RJGD", "providerReference": "mockpay_492d60ed-4e31-4880-a103-dda8939e2dab"}	\N	2026-10-06 02:02:40.656+03	31f0228f-002b-4a71-9335-e5845c66538b
742dbb34-377f-402d-b31e-c2b1cf25cfce	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	BOOKING_CONFIRMED	Booking	31f0228f-002b-4a71-9335-e5845c66538b	{"amount": 127, "currency": "EUR", "bookingReference": "NVU3RJGD"}	\N	2026-10-06 02:02:40.658+03	31f0228f-002b-4a71-9335-e5845c66538b
07a103c4-8c5f-4deb-b866-a951d43a01d2	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	SEAT_HOLD_CONVERTED	Booking	31f0228f-002b-4a71-9335-e5845c66538b	{"holdCount": 1, "seatNumbers": ["1A"], "bookingReference": "NVU3RJGD"}	\N	2026-10-06 02:02:40.659+03	31f0228f-002b-4a71-9335-e5845c66538b
7cc04e48-aed1-4f99-b4de-40557b4d0427	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	74db8183-72c7-4a5f-99dc-376296188d70	\N	\N	2026-10-06 02:03:00.735+03	\N
5efe24c4-eebe-4c0b-8318-f8ee1150447e	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-06 02:03:22.619+03	\N
edf5142d-9061-41ac-a276-e27a3b3e39eb	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	67372d8a-33ab-49e1-87ae-490c9aa49394	\N	\N	2026-10-06 02:04:50.519+03	\N
1303f343-af5c-4b70-82c8-fcf20e64ae3a	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-06 02:04:57.191+03	\N
66d53906-9cd6-4ef0-9ad6-fb45577e42c3	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	cf1e1081-5126-423a-8553-6ea2956affdf	\N	\N	2026-10-06 12:58:17.827+03	\N
21430f8a-343e-4565-9c76-7febc233ba0d	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	fb856980-4416-4229-b82e-bf45fa83f126	\N	\N	2026-10-06 12:59:57.586+03	\N
bb06062e-cfb9-41e7-8bfe-4f5de8f96924	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-06 13:00:07.368+03	\N
403d63cb-f767-4bc6-b712-4d633b3d44d5	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	3bb340ae-1cb2-4680-b9de-9264db1e3c26	\N	\N	2026-10-06 13:01:58.57+03	\N
6a73662a-945e-4a9a-87f7-8b644969db2c	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-06 14:15:22.63+03	\N
ce420cad-b132-4e6f-9950-4ea0f2bc86ef	\N	User	LOGIN_FAILED	User	\N	{"email": "nobody@example.com"}	::1	2026-10-06 14:15:37.909+03	\N
7c63f922-b99b-4690-9462-09a80cba679c	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	fa37f552-0917-4852-b8ae-049efa0103c8	\N	\N	2026-10-06 14:15:40.056+03	\N
082b8c17-fa53-4fd2-9947-255f04dcf3bd	34eedc56-29ef-4665-87fa-648c6a23dc72	User	USER_LOGGED_IN	User	34eedc56-29ef-4665-87fa-648c6a23dc72	\N	::1	2026-10-06 14:15:55.297+03	\N
7d6ca36e-0610-4d18-bd2a-50d6132aa549	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-06 14:16:02.545+03	\N
989214ea-fb86-49dd-bfe2-1faaaf45c7fc	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	d672ad58-137f-4bdc-a234-8897ca28a8f0	\N	\N	2026-10-06 15:33:39.01+03	\N
25b85830-bffa-4a47-ab53-9b0be7222beb	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-06 15:33:49.942+03	\N
40ef1ec2-23da-4d62-b9c9-9d43ff935c6f	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	1df797a0-59fc-4d4b-8601-05b21cca4825	\N	\N	2026-10-06 15:34:02.983+03	\N
a8b94c93-e68a-4886-8689-b0a44ffd91df	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-06 15:34:08.889+03	\N
2f8d1da3-f99f-4002-809d-705ddbbe7279	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	BOOKING_CREATED	Booking	e4efd9f8-c6c9-44a8-96b5-ca3e6cce8e45	{"flightNumber": "NV103", "bookingReference": "NVCXQJF8"}	\N	2026-10-06 15:34:52.432+03	e4efd9f8-c6c9-44a8-96b5-ca3e6cce8e45
01c9dc0a-7c5f-4c70-8e7b-c0bc86ce57af	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	SEAT_HELD	Booking	e4efd9f8-c6c9-44a8-96b5-ca3e6cce8e45	{"holdCount": 1, "seatNumbers": ["7A"], "flightNumber": "NV103", "bookingReference": "NVCXQJF8"}	\N	2026-10-06 15:34:52.434+03	e4efd9f8-c6c9-44a8-96b5-ca3e6cce8e45
a82bc944-cb20-4ed8-985b-48badb843c90	\N	System	SEAT_HOLD_EXPIRED	SeatHold	\N	{"holdCount": 1}	\N	2026-10-06 15:50:00.016+03	\N
8d2a0072-62a2-44d9-adb4-6607d8df2139	\N	System	BOOKING_CANCELLED	Booking	e4efd9f8-c6c9-44a8-96b5-ca3e6cce8e45	{"reason": "Seat holds expired before payment — cancelled automatically", "bookingReference": "NVCXQJF8"}	\N	2026-10-06 15:50:00.022+03	e4efd9f8-c6c9-44a8-96b5-ca3e6cce8e45
a968b666-9052-4ab9-ac99-0d3e11e6fb61	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	5507ffcb-ab03-48ac-9c26-56591530ee78	\N	\N	2026-10-06 15:50:33.771+03	\N
8797236b-5f13-42e0-8233-20099d0f1951	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-06 15:50:48.607+03	\N
1a99d823-763c-4cef-b6e9-f72f29cd70f5	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	db2ceda1-0d5d-4fd1-adb7-e75f8cfb479d	\N	\N	2026-10-06 15:57:20.92+03	\N
84e18c69-3044-46df-ad26-c378e6f5633c	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-06 15:57:27.952+03	\N
e4b16b30-acd2-45c2-a44d-712a554959d1	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	BOOKING_CREATED	Booking	00598b8b-835f-442a-a2f2-ad6d0bf3417f	{"flightNumber": "NV103", "bookingReference": "NV3T3GTC"}	\N	2026-10-06 15:58:38.348+03	00598b8b-835f-442a-a2f2-ad6d0bf3417f
4ac10aae-f249-4f74-ada1-7cb25c4a0bbb	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	SEAT_HELD	Booking	00598b8b-835f-442a-a2f2-ad6d0bf3417f	{"holdCount": 1, "seatNumbers": ["7B"], "flightNumber": "NV103", "bookingReference": "NV3T3GTC"}	\N	2026-10-06 15:58:38.351+03	00598b8b-835f-442a-a2f2-ad6d0bf3417f
9637e62c-a1f4-4f39-91dc-ebd3b9f8c355	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	0a0f3c46-3b6e-44e9-879a-ee9064dd7451	\N	\N	2026-10-06 16:07:42.086+03	\N
eb30cfe1-3c36-4aba-9a2e-7031095ec831	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-06 16:07:56.975+03	\N
46e53e15-f84d-42ae-bb25-676cdbb91983	\N	System	SEAT_HOLD_EXPIRED	SeatHold	\N	{"holdCount": 1}	\N	2026-10-06 16:14:00.041+03	\N
8126f9b6-d431-41f4-9ec1-b59abcda02f2	\N	System	BOOKING_CANCELLED	Booking	00598b8b-835f-442a-a2f2-ad6d0bf3417f	{"reason": "Seat holds expired before payment — cancelled automatically", "bookingReference": "NV3T3GTC"}	\N	2026-10-06 16:14:00.045+03	00598b8b-835f-442a-a2f2-ad6d0bf3417f
2b8b7ac5-30ef-4f26-963c-035962180fd3	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	3eced300-1560-4427-80af-23841e125544	\N	\N	2026-10-06 16:30:31.507+03	\N
06351566-a931-4e71-9ee6-3607aa10d699	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-06 16:30:42.462+03	\N
8f54a129-b39c-4901-8e24-82d04cbac6a5	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	BOOKING_CREATED	Booking	aa78e754-4d26-4759-891f-81febda53c2c	{"flightNumber": "NV202", "bookingReference": "NVD7BMF2"}	\N	2026-10-06 16:31:32.912+03	aa78e754-4d26-4759-891f-81febda53c2c
866e322a-8157-40a7-b784-88fc5af7a2fe	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	SEAT_HELD	Booking	aa78e754-4d26-4759-891f-81febda53c2c	{"holdCount": 1, "seatNumbers": ["1C"], "flightNumber": "NV202", "bookingReference": "NVD7BMF2"}	\N	2026-10-06 16:31:32.915+03	aa78e754-4d26-4759-891f-81febda53c2c
f2be7e3d-22de-4c7a-8e15-7348c6575676	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	PAYMENT_INTENT_CREATED	Payment	a9cdaf14-04f3-47f7-9c06-558c9d790309	{"paymentId": "a9cdaf14-04f3-47f7-9c06-558c9d790309", "providerStatus": "requires_payment_method", "bookingReference": "NVD7BMF2", "providerReference": "pi_3UNYSyRplmQkGUx51xyJs9Pp"}	\N	2026-10-06 16:31:37.128+03	aa78e754-4d26-4759-891f-81febda53c2c
80d231f1-8850-4da4-8077-4e51efadd505	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	028a86bc-a78d-454c-9c64-bd8a92cad93a	\N	\N	2026-10-06 16:32:21.817+03	\N
ac81ec57-2cd8-4cfd-b32a-d7c615e12a27	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-06 16:32:32.193+03	\N
9d9a2091-729d-486d-98bc-86633d09e6c4	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	f2a2423b-8f33-495a-90d6-4e9af77da2b2	\N	\N	2026-10-06 16:34:36.897+03	\N
c533498a-d287-4e14-827e-234bb939c805	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-06 16:34:46.393+03	\N
7c10351e-f403-4be8-b82c-2a3166b4eaab	07f79e6f-4ec3-470b-9058-4e793dc97d7e	User	USER_REGISTERED	User	07f79e6f-4ec3-470b-9058-4e793dc97d7e	\N	\N	2026-10-06 16:42:17.681+03	\N
1225cdc1-06e4-4e99-9ca5-72bffe038ffd	34eedc56-29ef-4665-87fa-648c6a23dc72	User	USER_LOGGED_IN	User	34eedc56-29ef-4665-87fa-648c6a23dc72	\N	::1	2026-10-06 16:43:37.092+03	\N
da5eae98-aa0d-4280-a1a1-8258bde365d0	34eedc56-29ef-4665-87fa-648c6a23dc72	User	USER_LOGGED_IN	User	34eedc56-29ef-4665-87fa-648c6a23dc72	\N	::1	2026-10-06 16:43:48.683+03	\N
ad4b1830-1ee0-449b-89a8-5d45f322e520	34eedc56-29ef-4665-87fa-648c6a23dc72	User	BOOKING_CREATED	Booking	b80a3617-7cb0-4566-90cc-441ef0c6ab77	{"flightNumber": "NV107", "bookingReference": "NV77EVVY"}	\N	2026-10-06 16:43:48.937+03	b80a3617-7cb0-4566-90cc-441ef0c6ab77
d6799d83-bd25-47a1-b1ea-d7ee83881e23	34eedc56-29ef-4665-87fa-648c6a23dc72	User	SEAT_HELD	Booking	b80a3617-7cb0-4566-90cc-441ef0c6ab77	{"holdCount": 1, "seatNumbers": ["31F"], "flightNumber": "NV107", "bookingReference": "NV77EVVY"}	\N	2026-10-06 16:43:48.939+03	b80a3617-7cb0-4566-90cc-441ef0c6ab77
b9effc88-2b08-40c3-9fef-147a394e85a8	34eedc56-29ef-4665-87fa-648c6a23dc72	User	PAYMENT_INTENT_CREATED	Payment	9fc35475-9496-431a-b51c-1e7497165387	{"paymentId": "9fc35475-9496-431a-b51c-1e7497165387", "providerStatus": "requires_payment_method", "bookingReference": "NV77EVVY", "providerReference": "pi_3UNYf8RplmQkGUx50vV7JACD"}	\N	2026-10-06 16:44:10.993+03	b80a3617-7cb0-4566-90cc-441ef0c6ab77
8109bb49-4499-4279-a228-ee9be0ef7c8d	\N	System	PAYMENT_SUCCEEDED	Payment	9fc35475-9496-431a-b51c-1e7497165387	{"via": "webhook", "paymentId": "9fc35475-9496-431a-b51c-1e7497165387", "transitioned": true, "providerReference": "pi_3UNYf8RplmQkGUx50vV7JACD"}	\N	2026-10-06 16:44:33.73+03	b80a3617-7cb0-4566-90cc-441ef0c6ab77
7bc656cf-4e75-40bb-a5a9-9f50ca11f873	\N	System	BOOKING_CONFIRMED	Booking	b80a3617-7cb0-4566-90cc-441ef0c6ab77	{"via": "webhook", "paymentId": "9fc35475-9496-431a-b51c-1e7497165387", "bookingReference": "NV77EVVY"}	\N	2026-10-06 16:44:33.733+03	b80a3617-7cb0-4566-90cc-441ef0c6ab77
2d43f4be-9eb4-41d2-95d1-7579efb51259	\N	System	SEAT_HOLD_CONVERTED	Booking	b80a3617-7cb0-4566-90cc-441ef0c6ab77	{"holdCount": 1, "seatNumbers": ["31F"], "bookingReference": "NV77EVVY"}	\N	2026-10-06 16:44:33.734+03	b80a3617-7cb0-4566-90cc-441ef0c6ab77
7f3ef0db-a9f9-45eb-9fba-09e267c46c3e	34eedc56-29ef-4665-87fa-648c6a23dc72	User	BOOKING_CREATED	Booking	e0137147-5d75-4ece-a4a1-b445a857193e	{"flightNumber": "NV107", "bookingReference": "NV7UHZRK"}	\N	2026-10-06 16:46:00.57+03	e0137147-5d75-4ece-a4a1-b445a857193e
dd425926-c5e6-49a6-b5c9-7e847c42c2ff	34eedc56-29ef-4665-87fa-648c6a23dc72	User	SEAT_HELD	Booking	e0137147-5d75-4ece-a4a1-b445a857193e	{"holdCount": 1, "seatNumbers": ["30B"], "flightNumber": "NV107", "bookingReference": "NV7UHZRK"}	\N	2026-10-06 16:46:00.572+03	e0137147-5d75-4ece-a4a1-b445a857193e
0c6b48f3-e3af-414b-b227-04ad75cd91b3	34eedc56-29ef-4665-87fa-648c6a23dc72	User	PAYMENT_INTENT_CREATED	Payment	dacc6ba6-960d-4a82-8a16-66dd49ef1bc5	{"paymentId": "dacc6ba6-960d-4a82-8a16-66dd49ef1bc5", "providerStatus": "requires_payment_method", "bookingReference": "NV7UHZRK", "providerReference": "pi_3UNYgvRplmQkGUx518LFwqmi"}	\N	2026-10-06 16:46:01.253+03	e0137147-5d75-4ece-a4a1-b445a857193e
a1d9cf04-fd85-4612-afd4-98a70a4eabb0	34eedc56-29ef-4665-87fa-648c6a23dc72	User	PAYMENT_INTENT_CREATED	Payment	319253f8-be55-47b0-8125-1e3d8f8dc4e9	{"paymentId": "319253f8-be55-47b0-8125-1e3d8f8dc4e9", "providerStatus": "requires_payment_method", "bookingReference": "NV7UHZRK", "providerReference": "pi_3UNYhPRplmQkGUx50egfFMzd"}	\N	2026-10-06 16:46:31.188+03	e0137147-5d75-4ece-a4a1-b445a857193e
f2b9e4a5-9e0e-4e87-a266-246386c07933	\N	System	PAYMENT_FAILED	Payment	dacc6ba6-960d-4a82-8a16-66dd49ef1bc5	{"via": "webhook", "paymentId": "dacc6ba6-960d-4a82-8a16-66dd49ef1bc5", "providerReference": "pi_3UNYgvRplmQkGUx518LFwqmi"}	\N	2026-10-06 16:46:03.239+03	e0137147-5d75-4ece-a4a1-b445a857193e
4a6c5f66-612b-44b3-8bd5-dc2804904ef4	\N	System	SEAT_HOLD_EXPIRED	SeatHold	\N	{"holdCount": 1}	\N	2026-10-06 16:47:00.012+03	\N
f7eaf503-c92f-4d30-870f-ace15c451ca6	\N	System	BOOKING_CANCELLED	Booking	aa78e754-4d26-4759-891f-81febda53c2c	{"reason": "Seat holds expired before payment — cancelled automatically", "bookingReference": "NVD7BMF2"}	\N	2026-10-06 16:47:00.014+03	aa78e754-4d26-4759-891f-81febda53c2c
9cf0dd0c-f32b-4a24-a39b-09a3f5e6e1ee	34eedc56-29ef-4665-87fa-648c6a23dc72	User	BOOKING_CREATED	Booking	2dd1ce15-a14f-46b5-b47f-a29f17fc4028	{"flightNumber": "NV107", "bookingReference": "NV64Z7TU"}	\N	2026-10-06 16:47:00.19+03	2dd1ce15-a14f-46b5-b47f-a29f17fc4028
08de6b8f-eab3-4e39-bd41-56a36c23b40d	34eedc56-29ef-4665-87fa-648c6a23dc72	User	SEAT_HELD	Booking	2dd1ce15-a14f-46b5-b47f-a29f17fc4028	{"holdCount": 1, "seatNumbers": ["36B"], "flightNumber": "NV107", "bookingReference": "NV64Z7TU"}	\N	2026-10-06 16:47:00.193+03	2dd1ce15-a14f-46b5-b47f-a29f17fc4028
186b0d03-d98c-494d-90d9-b28b277bb26c	34eedc56-29ef-4665-87fa-648c6a23dc72	User	PAYMENT_INTENT_CREATED	Payment	244d945e-6d3b-46bb-a9f7-acf2bfcfccb8	{"paymentId": "244d945e-6d3b-46bb-a9f7-acf2bfcfccb8", "providerStatus": "requires_payment_method", "bookingReference": "NV64Z7TU", "providerReference": "pi_3UNYhsRplmQkGUx50UTVpY0t"}	\N	2026-10-06 16:47:00.823+03	2dd1ce15-a14f-46b5-b47f-a29f17fc4028
4b0a4f5c-94d9-4e2d-87d3-14e5665e8234	34eedc56-29ef-4665-87fa-648c6a23dc72	User	BOOKING_CREATED	Booking	56a6a3e3-36d1-460a-bae7-1acaa3327684	{"flightNumber": "NV107", "bookingReference": "NV5P3KUT"}	\N	2026-10-06 16:49:28.331+03	56a6a3e3-36d1-460a-bae7-1acaa3327684
e8574dac-a96c-42d9-91d8-d5f1a24820bb	34eedc56-29ef-4665-87fa-648c6a23dc72	User	SEAT_HELD	Booking	56a6a3e3-36d1-460a-bae7-1acaa3327684	{"holdCount": 1, "seatNumbers": ["7A"], "flightNumber": "NV107", "bookingReference": "NV5P3KUT"}	\N	2026-10-06 16:49:28.333+03	56a6a3e3-36d1-460a-bae7-1acaa3327684
70178cce-cbeb-46f8-8f7e-f0516d33fcce	34eedc56-29ef-4665-87fa-648c6a23dc72	User	PAYMENT_INTENT_CREATED	Payment	9105a86f-88ea-43a3-aa19-11905761de0e	{"paymentId": "9105a86f-88ea-43a3-aa19-11905761de0e", "providerStatus": "requires_payment_method", "bookingReference": "NV5P3KUT", "providerReference": "pi_3UNYkGRplmQkGUx50Q3mnDRQ"}	\N	2026-10-06 16:49:29.025+03	56a6a3e3-36d1-460a-bae7-1acaa3327684
3b707869-672b-4c86-9da1-898785b390d6	\N	System	SEAT_HOLD_EXPIRED	SeatHold	\N	{"holdCount": 1}	\N	2026-10-06 17:02:00.012+03	\N
cadc5e4b-5dd3-4e83-804a-f1e9fedfa61f	\N	System	BOOKING_CANCELLED	Booking	e0137147-5d75-4ece-a4a1-b445a857193e	{"reason": "Seat holds expired before payment — cancelled automatically", "bookingReference": "NV7UHZRK"}	\N	2026-10-06 17:02:00.021+03	e0137147-5d75-4ece-a4a1-b445a857193e
1738dfc1-fd2a-4cf8-8f2a-476183e4e0bd	\N	System	SEAT_HOLD_EXPIRED	SeatHold	\N	{"holdCount": 1}	\N	2026-10-06 17:03:00.024+03	\N
83dffaa3-d1d5-4531-bda9-577b426ecca0	\N	System	BOOKING_CANCELLED	Booking	2dd1ce15-a14f-46b5-b47f-a29f17fc4028	{"reason": "Seat holds expired before payment — cancelled automatically", "bookingReference": "NV64Z7TU"}	\N	2026-10-06 17:03:00.026+03	2dd1ce15-a14f-46b5-b47f-a29f17fc4028
eb9d9005-7973-4bca-a85a-62488db9e815	\N	System	SEAT_HOLD_EXPIRED	SeatHold	\N	{"holdCount": 1}	\N	2026-10-06 17:05:00.014+03	\N
84e5385f-4cf3-4cc1-b6c5-a6e056ee7317	\N	System	BOOKING_CANCELLED	Booking	56a6a3e3-36d1-460a-bae7-1acaa3327684	{"reason": "Seat holds expired before payment — cancelled automatically", "bookingReference": "NV5P3KUT"}	\N	2026-10-06 17:05:00.015+03	56a6a3e3-36d1-460a-bae7-1acaa3327684
12e76539-5413-4bb2-9ad1-a1da88ebabf7	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	BOOKING_CREATED	Booking	59a7ed52-c362-44f1-b545-292fee0bf836	{"flightNumber": "NV103", "bookingReference": "NVZB8NEN"}	\N	2026-10-06 17:32:56.872+03	59a7ed52-c362-44f1-b545-292fee0bf836
049a128a-ba1b-41df-b9fb-4ab75ef13c20	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	SEAT_HELD	Booking	59a7ed52-c362-44f1-b545-292fee0bf836	{"holdCount": 1, "seatNumbers": ["2B"], "flightNumber": "NV103", "bookingReference": "NVZB8NEN"}	\N	2026-10-06 17:32:56.882+03	59a7ed52-c362-44f1-b545-292fee0bf836
d44389e6-1e3d-4cc0-ab91-62f73d8a969a	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	PAYMENT_INTENT_CREATED	Payment	42f1b64c-4537-4a4b-8611-eaeaa52f9d5b	{"paymentId": "42f1b64c-4537-4a4b-8611-eaeaa52f9d5b", "providerStatus": "requires_payment_method", "bookingReference": "NVZB8NEN", "providerReference": "pi_3UNZQQRplmQkGUx51vzdVvYe"}	\N	2026-10-06 17:33:02.094+03	59a7ed52-c362-44f1-b545-292fee0bf836
2c0c90b5-5603-4ec0-8844-449a3b6c52c6	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	e9db6f47-671d-4f13-9db0-bbbbafb0a0c6	\N	\N	2026-10-06 17:33:19.155+03	\N
05f6d4bd-82a9-4e26-957c-754c6ca11fd0	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-06 17:33:26.475+03	\N
4e83bc61-8b34-4c07-b489-1f750d656ae6	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	465e0914-89b2-4ea6-b6b1-ec73fe880968	\N	\N	2026-10-06 17:33:32.423+03	\N
5919873b-e8c8-425c-896a-a5fcc3a0f99c	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-06 17:33:39.156+03	\N
bd568d5c-7b46-4795-b551-88835b67ee14	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	d90f7756-9ebd-4d67-9919-a2c98947a9d9	\N	\N	2026-10-06 17:35:34.068+03	\N
3c2ff7a3-506d-4639-ac07-de8a66399d14	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-06 17:35:41.206+03	\N
7005fc53-e4fc-40fe-9f4d-d2c343fae5f4	34eedc56-29ef-4665-87fa-648c6a23dc72	User	USER_LOGGED_IN	User	34eedc56-29ef-4665-87fa-648c6a23dc72	\N	::1	2026-10-06 17:41:44.414+03	\N
6c42241b-15cf-4229-bd45-3cdcd9673123	\N	System	SEAT_HOLD_EXPIRED	SeatHold	\N	{"holdCount": 1}	\N	2026-10-06 17:48:00.022+03	\N
a8518e53-1950-4c9e-a459-c11d1f76b53c	\N	System	BOOKING_CANCELLED	Booking	59a7ed52-c362-44f1-b545-292fee0bf836	{"reason": "Seat holds expired before payment — cancelled automatically", "bookingReference": "NVZB8NEN"}	\N	2026-10-06 17:48:00.025+03	59a7ed52-c362-44f1-b545-292fee0bf836
663a29b6-b164-4cc1-8972-5b3160b827e8	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	bafc45e3-712f-44e6-978e-a3f7cdabc558	\N	\N	2026-10-06 17:52:45.796+03	\N
4cb8bf63-4452-4d39-8953-f210186d3628	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-06 17:53:01.83+03	\N
a3ff054d-4a7a-4fb8-85ae-7dc54b3a54b1	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	ff50d5ae-8f14-4d7c-bae2-baeae7261c69	\N	\N	2026-10-06 17:53:58.413+03	\N
5c025c5a-861c-44a7-afdd-4578a15f8a3c	34eedc56-29ef-4665-87fa-648c6a23dc72	User	USER_LOGGED_IN	User	34eedc56-29ef-4665-87fa-648c6a23dc72	\N	::1	2026-10-06 17:54:57.603+03	\N
f8cd7b69-331f-47ea-9a65-72aaacfb267e	34eedc56-29ef-4665-87fa-648c6a23dc72	User	BOOKING_CREATED	Booking	ed6701ed-813e-4027-a3e1-0a01d3d911e3	{"flightNumber": "NV107", "bookingReference": "NVHPT96J"}	\N	2026-10-06 17:54:57.931+03	ed6701ed-813e-4027-a3e1-0a01d3d911e3
17eb1c12-a140-4624-b064-16c43452f6a5	34eedc56-29ef-4665-87fa-648c6a23dc72	User	SEAT_HELD	Booking	ed6701ed-813e-4027-a3e1-0a01d3d911e3	{"holdCount": 1, "seatNumbers": ["7B"], "flightNumber": "NV107", "bookingReference": "NVHPT96J"}	\N	2026-10-06 17:54:57.933+03	ed6701ed-813e-4027-a3e1-0a01d3d911e3
ba17f954-9332-442b-b7bd-030cefdda675	34eedc56-29ef-4665-87fa-648c6a23dc72	User	PAYMENT_INTENT_CREATED	Payment	8f1086a6-f5bc-4f7a-b5d3-081e4ffc2fd3	{"paymentId": "8f1086a6-f5bc-4f7a-b5d3-081e4ffc2fd3", "providerStatus": "requires_payment_method", "bookingReference": "NVHPT96J", "providerReference": "pi_3UNZleRplmQkGUx50ohWry7z"}	\N	2026-10-06 17:54:58.672+03	ed6701ed-813e-4027-a3e1-0a01d3d911e3
9425d7d4-341b-4dd4-9ae7-458a83e305b7	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-06 17:57:17.369+03	\N
5e3b4ed3-426e-4379-8b52-66a7a3c04251	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	BOOKING_CREATED	Booking	56a92bc1-1398-4fb3-911c-f60891b143a3	{"flightNumber": "NV202", "bookingReference": "NVWEEHVW"}	\N	2026-10-06 17:58:11.357+03	56a92bc1-1398-4fb3-911c-f60891b143a3
72a34c47-7198-444e-bde0-4d5976d2ab87	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	SEAT_HELD	Booking	56a92bc1-1398-4fb3-911c-f60891b143a3	{"holdCount": 1, "seatNumbers": ["2C"], "flightNumber": "NV202", "bookingReference": "NVWEEHVW"}	\N	2026-10-06 17:58:11.361+03	56a92bc1-1398-4fb3-911c-f60891b143a3
4dd7d3aa-c79f-4ef9-81fa-25d911d0012e	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-06 23:45:27.344+03	\N
ca4c49e4-5763-4f61-8da9-0f0962b27e4f	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	PAYMENT_INTENT_CREATED	Payment	b9229034-c0e4-45b6-ac77-9ff635bb0464	{"paymentId": "b9229034-c0e4-45b6-ac77-9ff635bb0464", "providerStatus": "requires_payment_method", "bookingReference": "NVWEEHVW", "providerReference": "pi_3UNZooRplmQkGUx51YBJ1xGS"}	\N	2026-10-06 17:58:14.939+03	56a92bc1-1398-4fb3-911c-f60891b143a3
5fb7cc5b-7877-43ae-8831-d2e491fb2090	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	BOOKING_CANCELLED	Booking	56a92bc1-1398-4fb3-911c-f60891b143a3	{"bookingReference": "NVWEEHVW"}	\N	2026-10-06 18:01:05.177+03	56a92bc1-1398-4fb3-911c-f60891b143a3
44fcb0ec-02c4-4761-991e-631d4e30cb9f	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	SEAT_HOLD_RELEASED	Booking	56a92bc1-1398-4fb3-911c-f60891b143a3	{"holdCount": 1, "bookingReference": "NVWEEHVW"}	\N	2026-10-06 18:01:05.179+03	56a92bc1-1398-4fb3-911c-f60891b143a3
0f1252b4-2079-413a-acb5-046c5443aeb3	\N	System	SEAT_HOLD_EXPIRED	SeatHold	\N	{"holdCount": 1}	\N	2026-10-06 18:10:00.016+03	\N
b36fc484-2539-4a67-a129-84097d59cac7	\N	System	BOOKING_CANCELLED	Booking	ed6701ed-813e-4027-a3e1-0a01d3d911e3	{"reason": "Seat holds expired before payment — cancelled automatically", "bookingReference": "NVHPT96J"}	\N	2026-10-06 18:10:00.13+03	ed6701ed-813e-4027-a3e1-0a01d3d911e3
f893e324-ef87-4b89-af1c-36051da18e24	34eedc56-29ef-4665-87fa-648c6a23dc72	User	USER_LOGGED_IN	User	34eedc56-29ef-4665-87fa-648c6a23dc72	\N	::1	2026-10-06 18:13:53.67+03	\N
056bcf59-859d-4221-9a78-3d237494fbe0	34eedc56-29ef-4665-87fa-648c6a23dc72	User	BOOKING_CREATED	Booking	e6f4fba4-c2c1-41eb-ac31-0fd41cd99b5b	{"flightNumber": "NV107", "bookingReference": "NVNY4KYL"}	\N	2026-10-06 18:13:54.114+03	e6f4fba4-c2c1-41eb-ac31-0fd41cd99b5b
5e37f02a-107d-4759-9fa6-2970289b0e66	34eedc56-29ef-4665-87fa-648c6a23dc72	User	SEAT_HELD	Booking	e6f4fba4-c2c1-41eb-ac31-0fd41cd99b5b	{"holdCount": 1, "seatNumbers": ["7C"], "flightNumber": "NV107", "bookingReference": "NVNY4KYL"}	\N	2026-10-06 18:13:54.116+03	e6f4fba4-c2c1-41eb-ac31-0fd41cd99b5b
0b4417cb-2a3b-45a3-958b-84ff3d610538	34eedc56-29ef-4665-87fa-648c6a23dc72	User	USER_LOGGED_IN	User	34eedc56-29ef-4665-87fa-648c6a23dc72	\N	::1	2026-10-06 18:15:24.933+03	\N
0499922b-18c8-4213-baf3-387e680f5dd3	34eedc56-29ef-4665-87fa-648c6a23dc72	User	PAYMENT_INTENT_CREATED	Payment	63b398ce-ecfb-4e54-8f35-a7cec9f3753a	{"paymentId": "63b398ce-ecfb-4e54-8f35-a7cec9f3753a", "providerStatus": "requires_payment_method", "bookingReference": "NVNY4KYL", "providerReference": "pi_3UNa5TRplmQkGUx50vqXk3NY"}	\N	2026-10-06 18:15:27.55+03	e6f4fba4-c2c1-41eb-ac31-0fd41cd99b5b
b54a522d-089c-4d34-8e09-7588c9d093a6	34eedc56-29ef-4665-87fa-648c6a23dc72	User	USER_LOGGED_IN	User	34eedc56-29ef-4665-87fa-648c6a23dc72	\N	::1	2026-10-06 18:16:41.35+03	\N
8f5f1953-d852-41de-94c2-9283ffa2ff93	34eedc56-29ef-4665-87fa-648c6a23dc72	User	USER_LOGGED_IN	User	34eedc56-29ef-4665-87fa-648c6a23dc72	\N	::1	2026-10-06 18:21:09.357+03	\N
01c3723c-ab9f-432a-8332-3dbb2599559d	34eedc56-29ef-4665-87fa-648c6a23dc72	User	USER_LOGGED_IN	User	34eedc56-29ef-4665-87fa-648c6a23dc72	\N	::1	2026-10-06 18:21:57.024+03	\N
52000f27-0d89-459c-9569-739f5b5aa36e	34eedc56-29ef-4665-87fa-648c6a23dc72	User	USER_LOGGED_IN	User	34eedc56-29ef-4665-87fa-648c6a23dc72	\N	::1	2026-10-06 18:22:49.904+03	\N
37d0ac7d-2496-4b1e-acfb-c2dd36b860c9	34eedc56-29ef-4665-87fa-648c6a23dc72	User	USER_LOGGED_IN	User	34eedc56-29ef-4665-87fa-648c6a23dc72	\N	::1	2026-10-06 18:24:09.805+03	\N
639696ec-1011-4811-a883-20b7c58f3f1b	34eedc56-29ef-4665-87fa-648c6a23dc72	User	USER_LOGGED_IN	User	34eedc56-29ef-4665-87fa-648c6a23dc72	\N	::1	2026-10-06 18:25:03.091+03	\N
292be3f9-b581-4347-9ae1-5c665af4952b	\N	System	PAYMENT_SUCCEEDED	Payment	63b398ce-ecfb-4e54-8f35-a7cec9f3753a	{"via": "webhook", "paymentId": "63b398ce-ecfb-4e54-8f35-a7cec9f3753a", "transitioned": true, "providerReference": "pi_3UNa5TRplmQkGUx50vqXk3NY"}	\N	2026-10-06 18:25:14.644+03	e6f4fba4-c2c1-41eb-ac31-0fd41cd99b5b
83cb6f44-a65b-40cd-91d0-14972aa4fca9	\N	System	BOOKING_CONFIRMED	Booking	e6f4fba4-c2c1-41eb-ac31-0fd41cd99b5b	{"via": "webhook", "paymentId": "63b398ce-ecfb-4e54-8f35-a7cec9f3753a", "bookingReference": "NVNY4KYL"}	\N	2026-10-06 18:25:14.657+03	e6f4fba4-c2c1-41eb-ac31-0fd41cd99b5b
274d4647-e692-45d5-afea-af6909979172	\N	System	SEAT_HOLD_CONVERTED	Booking	e6f4fba4-c2c1-41eb-ac31-0fd41cd99b5b	{"holdCount": 1, "seatNumbers": ["7C"], "bookingReference": "NVNY4KYL"}	\N	2026-10-06 18:25:14.659+03	e6f4fba4-c2c1-41eb-ac31-0fd41cd99b5b
fd38ded1-c759-4dd2-adda-b81262657486	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	BOOKING_CREATED	Booking	b080bb80-af80-4f63-b70b-5963cea26f6c	{"flightNumber": "NV100", "bookingReference": "NV8XH8LV"}	\N	2026-10-06 18:30:04.465+03	b080bb80-af80-4f63-b70b-5963cea26f6c
9e36b94a-160f-4cf6-a922-4977769bf37c	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	SEAT_HELD	Booking	b080bb80-af80-4f63-b70b-5963cea26f6c	{"holdCount": 1, "seatNumbers": ["10D"], "flightNumber": "NV100", "bookingReference": "NV8XH8LV"}	\N	2026-10-06 18:30:04.468+03	b080bb80-af80-4f63-b70b-5963cea26f6c
3384b2f1-4175-48f1-8de9-93cf7aa0008b	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	PAYMENT_INTENT_CREATED	Payment	929ccd26-87ca-4270-8c20-1e1f4ee03945	{"paymentId": "929ccd26-87ca-4270-8c20-1e1f4ee03945", "providerStatus": "requires_payment_method", "bookingReference": "NV8XH8LV", "providerReference": "pi_3UNaJiRplmQkGUx50jJ9TlhY"}	\N	2026-10-06 18:30:10.319+03	b080bb80-af80-4f63-b70b-5963cea26f6c
fb142d56-4290-4720-a2a1-ec3e31c8fb0a	\N	System	PAYMENT_SUCCEEDED	Payment	929ccd26-87ca-4270-8c20-1e1f4ee03945	{"via": "retrieve", "paymentId": "929ccd26-87ca-4270-8c20-1e1f4ee03945", "transitioned": true, "providerReference": "pi_3UNaJiRplmQkGUx50jJ9TlhY"}	\N	2026-10-06 18:32:44.524+03	b080bb80-af80-4f63-b70b-5963cea26f6c
cab051ca-5cd0-49ab-9a67-c0c728c78f24	\N	System	BOOKING_CONFIRMED	Booking	b080bb80-af80-4f63-b70b-5963cea26f6c	{"via": "retrieve", "paymentId": "929ccd26-87ca-4270-8c20-1e1f4ee03945", "bookingReference": "NV8XH8LV"}	\N	2026-10-06 18:32:44.526+03	b080bb80-af80-4f63-b70b-5963cea26f6c
924fd74f-9dab-413d-a386-8323c09d827b	\N	System	SEAT_HOLD_CONVERTED	Booking	b080bb80-af80-4f63-b70b-5963cea26f6c	{"holdCount": 1, "seatNumbers": ["10D"], "bookingReference": "NV8XH8LV"}	\N	2026-10-06 18:32:44.527+03	b080bb80-af80-4f63-b70b-5963cea26f6c
656bda68-da10-4842-9a9b-caca993352eb	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	67908fb0-a8b2-4e31-97b8-b700ec25cc31	\N	\N	2026-10-06 18:33:02.046+03	\N
a8b59369-eceb-44ed-805f-9bd76832d93e	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-06 18:33:19.563+03	\N
e3e42606-b1e5-4c03-8cd5-fc21cb76a126	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	b55b988e-d165-4f29-897b-18b95886ec11	\N	\N	2026-10-06 23:41:14.143+03	\N
fd538778-e69f-4caf-98c7-11d743ede851	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-06 23:41:26.461+03	\N
0a9e989e-091c-41b0-924e-be9b569e9fe4	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	BOOKING_CREATED	Booking	4226ef1a-2643-4ff4-9669-05fdbc7c3157	{"flightNumber": "NV104", "bookingReference": "NVU8XPPU"}	\N	2026-10-06 23:42:19.005+03	4226ef1a-2643-4ff4-9669-05fdbc7c3157
e1e6d6bc-90eb-4732-85bd-b59c4d3cc7da	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	SEAT_HELD	Booking	4226ef1a-2643-4ff4-9669-05fdbc7c3157	{"holdCount": 1, "seatNumbers": ["5C"], "flightNumber": "NV104", "bookingReference": "NVU8XPPU"}	\N	2026-10-06 23:42:19.008+03	4226ef1a-2643-4ff4-9669-05fdbc7c3157
d77e6880-41e6-4001-be58-edbb495dfb34	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	PAYMENT_INTENT_CREATED	Payment	74aa0b32-8f39-4ea1-8d12-783ed929913a	{"paymentId": "74aa0b32-8f39-4ea1-8d12-783ed929913a", "providerStatus": "requires_payment_method", "bookingReference": "NVU8XPPU", "providerReference": "pi_3UNfBvRplmQkGUx51d9z4g7R"}	\N	2026-10-06 23:42:26.898+03	4226ef1a-2643-4ff4-9669-05fdbc7c3157
33eb1173-a60f-4660-a484-a2803d630dbf	\N	System	PAYMENT_SUCCEEDED	Payment	74aa0b32-8f39-4ea1-8d12-783ed929913a	{"via": "retrieve", "paymentId": "74aa0b32-8f39-4ea1-8d12-783ed929913a", "transitioned": true, "providerReference": "pi_3UNfBvRplmQkGUx51d9z4g7R"}	\N	2026-10-06 23:43:38.485+03	4226ef1a-2643-4ff4-9669-05fdbc7c3157
6321ccb0-1855-4f91-ab9d-5dbd73c644a0	\N	System	BOOKING_CONFIRMED	Booking	4226ef1a-2643-4ff4-9669-05fdbc7c3157	{"via": "retrieve", "paymentId": "74aa0b32-8f39-4ea1-8d12-783ed929913a", "bookingReference": "NVU8XPPU"}	\N	2026-10-06 23:43:38.487+03	4226ef1a-2643-4ff4-9669-05fdbc7c3157
975e79cb-0972-4b7b-a69c-60f8e48915b1	\N	System	SEAT_HOLD_CONVERTED	Booking	4226ef1a-2643-4ff4-9669-05fdbc7c3157	{"holdCount": 1, "seatNumbers": ["5C"], "bookingReference": "NVU8XPPU"}	\N	2026-10-06 23:43:38.489+03	4226ef1a-2643-4ff4-9669-05fdbc7c3157
f47a34ce-f3f8-4b95-99ea-7f99bcc5d1ff	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	d1e2ccc6-422e-43f0-9818-50d6fc6988f9	\N	\N	2026-10-06 23:45:09.115+03	\N
a17c0ea2-377b-4081-ae84-fbbdbf0c99dd	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Staff	REFUND_COMPLETED	Refund	614943cd-d913-41d1-b771-1a8f9f17b27a	{"amount": 127, "reason": "not good", "currency": "EUR", "refundId": "614943cd-d913-41d1-b771-1a8f9f17b27a", "paymentId": "74aa0b32-8f39-4ea1-8d12-783ed929913a", "bookingReference": "NVU8XPPU", "providerReference": "re_3UNfBvRplmQkGUx51PelnMIR"}	\N	2026-10-06 23:46:12.913+03	4226ef1a-2643-4ff4-9669-05fdbc7c3157
d06798a2-731e-4472-9e33-6e28ed1d0502	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	0186a4de-484e-4c19-98c1-71cb05bf5c74	\N	\N	2026-10-06 23:46:30.785+03	\N
92d6f216-6f48-43af-a456-e46407cd8fa5	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-06 23:46:37.963+03	\N
21252807-5ae2-4c07-98d3-defb419728e5	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	BOOKING_CREATED	Booking	8f0251b4-1af2-4397-a781-ac7f2b6ceedc	{"flightNumber": "NV202", "bookingReference": "NVPTJ3KU"}	\N	2026-10-07 12:28:45.817+03	8f0251b4-1af2-4397-a781-ac7f2b6ceedc
11b91ed0-c818-41cf-ae9a-2742084c3491	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	SEAT_HELD	Booking	8f0251b4-1af2-4397-a781-ac7f2b6ceedc	{"holdCount": 1, "seatNumbers": ["1A"], "flightNumber": "NV202", "bookingReference": "NVPTJ3KU"}	\N	2026-10-07 12:28:45.838+03	8f0251b4-1af2-4397-a781-ac7f2b6ceedc
285e0b07-6193-4950-8c0b-4cb873f1a5d0	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	75cf01dc-31f1-4187-b220-1776483dced7	\N	\N	2026-10-07 12:29:05.952+03	\N
94c68620-5f23-4728-9220-f971b9cad5b7	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-07 12:29:16.305+03	\N
28c7345f-8907-475d-a7d2-931a76d04a26	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	02c0e66b-cb83-4770-be56-5b63fdca5c1d	\N	\N	2026-10-07 12:29:40.17+03	\N
10b848fc-4b46-42c6-873b-3396817c6d94	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-07 12:29:45.124+03	\N
45ed501d-c0da-44ac-a747-006377b60788	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	PAYMENT_INTENT_CREATED	Payment	38dbc3d6-a54e-400d-a7c4-ead529ea78d0	{"paymentId": "38dbc3d6-a54e-400d-a7c4-ead529ea78d0", "providerStatus": "requires_payment_method", "bookingReference": "NVPTJ3KU", "providerReference": "pi_3UNrAZRplmQkGUx50dbjfSPH"}	\N	2026-10-07 12:29:49.641+03	8f0251b4-1af2-4397-a781-ac7f2b6ceedc
2d687e57-83b8-47db-aa36-d0887c1b4c64	\N	System	PAYMENT_SUCCEEDED	Payment	38dbc3d6-a54e-400d-a7c4-ead529ea78d0	{"via": "retrieve", "paymentId": "38dbc3d6-a54e-400d-a7c4-ead529ea78d0", "transitioned": true, "providerReference": "pi_3UNrAZRplmQkGUx50dbjfSPH"}	\N	2026-10-07 12:30:56.919+03	8f0251b4-1af2-4397-a781-ac7f2b6ceedc
7d58828f-e0bd-4bf3-a08c-ddf74f744503	\N	System	BOOKING_CONFIRMED	Booking	8f0251b4-1af2-4397-a781-ac7f2b6ceedc	{"via": "retrieve", "paymentId": "38dbc3d6-a54e-400d-a7c4-ead529ea78d0", "bookingReference": "NVPTJ3KU"}	\N	2026-10-07 12:30:56.922+03	8f0251b4-1af2-4397-a781-ac7f2b6ceedc
e89d8538-938c-407d-83a8-175a26aecb7a	\N	System	SEAT_HOLD_CONVERTED	Booking	8f0251b4-1af2-4397-a781-ac7f2b6ceedc	{"holdCount": 1, "seatNumbers": ["1A"], "bookingReference": "NVPTJ3KU"}	\N	2026-10-07 12:30:56.924+03	8f0251b4-1af2-4397-a781-ac7f2b6ceedc
03e097f9-1c59-4d81-8a39-f72b54447741	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-07 12:32:51.808+03	\N
e1184d97-9f73-40ce-b19c-0fceb32cda8e	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	bed02d1a-749e-4571-a0d2-2667df683cea	\N	\N	2026-10-07 12:33:13.218+03	\N
e06f9a90-612c-46ee-af3c-6a2626ee280a	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-07 12:33:21.942+03	\N
da70433a-e058-4288-b4ef-f15a4873bd85	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	67cfcbf5-f607-4f98-ba77-83ed89454be0	\N	\N	2026-10-07 14:37:45.579+03	\N
821058c0-0bef-41eb-9c7a-cdf5accc2d11	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-07 14:37:52.926+03	\N
f8e8815f-1088-44ee-9b98-f0005b6ffce8	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	3f47cb5a-e2a4-4c9d-afc7-8fa29ff06821	\N	\N	2026-10-07 14:38:40.782+03	\N
e394dec2-387a-41bf-a631-1942562b7314	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-07 14:39:02.56+03	\N
74128403-f072-4ae3-9900-4bdca6cd3734	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	29a40eff-22e2-4a28-8069-bc90061ca1b8	\N	\N	2026-10-07 14:41:12.269+03	\N
df612e50-194b-4e56-a6e7-c04360c340ef	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-07 14:41:20.45+03	\N
db2e04b8-0e69-41de-9a50-c827c810da51	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	3ae0930b-7903-438d-b13d-1c74dfd4dfe8	\N	\N	2026-10-07 14:57:43.843+03	\N
58d4aef5-31eb-42a3-873c-85f22da963e8	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-07 14:58:55.626+03	\N
ffb4ed4f-e316-4a36-9d7d-be6e080ae70a	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	0960f211-bf12-4657-9134-de8215f96621	\N	\N	2026-10-07 15:02:16.133+03	\N
eca26b2c-39ae-4123-8c74-24b5ae442428	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-07 15:02:27.255+03	\N
01984ad6-adea-49d2-952a-9845edf34006	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	5a48f70c-a3c4-41c5-a4b6-a8fdd26c50cb	\N	\N	2026-10-07 15:03:59.869+03	\N
3bb0e907-0fb8-467c-850e-3264839dbc8c	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-07 15:04:08.029+03	\N
3e34e640-a05e-4389-bf07-739404c49c26	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	0890175e-21fa-48ed-bb4d-89c98ce323c2	\N	\N	2026-10-07 15:04:51.55+03	\N
4df7dd87-897f-424e-99e3-a8b36b0e5a56	24e598b1-ee10-457d-83bc-122a7e1ba398	User	USER_REGISTERED	User	24e598b1-ee10-457d-83bc-122a7e1ba398	\N	\N	2026-10-07 15:06:15.8+03	\N
ab67565c-361f-4c75-9a23-13ede7b0a653	24e598b1-ee10-457d-83bc-122a7e1ba398	User	EMAIL_VERIFIED	User	24e598b1-ee10-457d-83bc-122a7e1ba398	\N	::1	2026-10-07 15:06:46.342+03	\N
6253a840-c21a-4852-a33c-fb67ff6a7daa	24e598b1-ee10-457d-83bc-122a7e1ba398	User	USER_LOGGED_IN	User	24e598b1-ee10-457d-83bc-122a7e1ba398	\N	::1	2026-10-07 15:06:50.021+03	\N
cc014cc7-4a4e-43be-92aa-f5b75dc9dd2b	24e598b1-ee10-457d-83bc-122a7e1ba398	User	BOOKING_CREATED	Booking	ec52f2d5-f1cc-4707-8a00-32cc1b503a69	{"flightNumber": "NV100", "bookingReference": "NVJP656P"}	\N	2026-10-07 15:11:05.161+03	ec52f2d5-f1cc-4707-8a00-32cc1b503a69
25ed9b40-a9f6-4f68-8e66-c589de0f770b	24e598b1-ee10-457d-83bc-122a7e1ba398	User	SEAT_HELD	Booking	ec52f2d5-f1cc-4707-8a00-32cc1b503a69	{"holdCount": 1, "seatNumbers": ["7A"], "flightNumber": "NV100", "bookingReference": "NVJP656P"}	\N	2026-10-07 15:11:05.164+03	ec52f2d5-f1cc-4707-8a00-32cc1b503a69
e94bd34e-0730-4cf3-8b99-99b26e811f8d	24e598b1-ee10-457d-83bc-122a7e1ba398	User	PAYMENT_INTENT_CREATED	Payment	6ce64e5f-17f4-4bff-a8d1-9e21e264e5ce	{"paymentId": "6ce64e5f-17f4-4bff-a8d1-9e21e264e5ce", "providerStatus": "requires_payment_method", "bookingReference": "NVJP656P", "providerReference": "pi_3UNtghRplmQkGUx508z8FBor"}	\N	2026-10-07 15:11:10.184+03	ec52f2d5-f1cc-4707-8a00-32cc1b503a69
d294c6cd-9cd6-4236-a6a5-618536d63faa	\N	System	PAYMENT_SUCCEEDED	Payment	6ce64e5f-17f4-4bff-a8d1-9e21e264e5ce	{"via": "retrieve", "paymentId": "6ce64e5f-17f4-4bff-a8d1-9e21e264e5ce", "transitioned": true, "providerReference": "pi_3UNtghRplmQkGUx508z8FBor"}	\N	2026-10-07 15:12:48.26+03	ec52f2d5-f1cc-4707-8a00-32cc1b503a69
d03dc097-1b65-4525-b0b7-82bd7bef29e3	\N	System	BOOKING_CONFIRMED	Booking	ec52f2d5-f1cc-4707-8a00-32cc1b503a69	{"via": "retrieve", "paymentId": "6ce64e5f-17f4-4bff-a8d1-9e21e264e5ce", "bookingReference": "NVJP656P"}	\N	2026-10-07 15:12:48.263+03	ec52f2d5-f1cc-4707-8a00-32cc1b503a69
6105453d-2018-4f22-9df4-be443051f1ae	\N	System	SEAT_HOLD_CONVERTED	Booking	ec52f2d5-f1cc-4707-8a00-32cc1b503a69	{"holdCount": 1, "seatNumbers": ["7A"], "bookingReference": "NVJP656P"}	\N	2026-10-07 15:12:48.264+03	ec52f2d5-f1cc-4707-8a00-32cc1b503a69
f1884b6e-3774-4aa1-b649-3291a3decbfe	24e598b1-ee10-457d-83bc-122a7e1ba398	User	LOGOUT	Session	195eaa6f-2e8f-4550-a588-aed9b73c2e39	\N	\N	2026-10-07 15:14:02.919+03	\N
03e81407-fdf3-4fd3-9947-41886a3c4f58	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-07 15:14:14.037+03	\N
823c0b55-97b2-4cd3-ba97-a5164e05c349	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	b0ba4b25-d8e7-4055-b261-bed930c7c3ca	\N	\N	2026-10-07 15:19:34.334+03	\N
86f66bec-511f-4d47-a5e5-8beee8ad0110	24e598b1-ee10-457d-83bc-122a7e1ba398	User	USER_LOGGED_IN	User	24e598b1-ee10-457d-83bc-122a7e1ba398	\N	::1	2026-10-07 15:19:45.204+03	\N
37c8d439-6708-486e-a69e-71104285c136	24e598b1-ee10-457d-83bc-122a7e1ba398	User	LOGOUT	Session	f14f7d65-1af7-4114-bbe8-d30cca026eae	\N	\N	2026-10-08 14:19:43.183+03	\N
d67794df-ea5f-431d-964d-1e64f5584c3d	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-08 14:19:57.547+03	\N
1ee6b19d-291b-4159-a789-783b2341a3a2	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Staff	USER_CREATED	User	acdd78f6-9c1a-4ee8-9670-69422e336fad	{"roleIds": ["43f19c03-b120-4383-8dec-572c8f50039a"]}	\N	2026-10-08 14:22:01.344+03	\N
1085c680-fbbb-4757-b37a-fe533ccb94e1	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	9cf2d390-48ec-4053-939e-d6e9bac02794	\N	\N	2026-10-08 14:22:05.797+03	\N
819cb834-f10a-4aa0-b5a9-c8e06ac88ed7	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	USER_LOGGED_IN	User	acdd78f6-9c1a-4ee8-9670-69422e336fad	\N	::1	2026-10-08 14:22:17.059+03	\N
6801b839-5f6c-4e31-9123-ed8e745844e1	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	LOGOUT	Session	382a5e00-4364-4b76-99fc-a323d0191e89	\N	\N	2026-10-08 14:22:51.572+03	\N
fba372ab-0572-49a8-a661-820d4e6fc68d	24e598b1-ee10-457d-83bc-122a7e1ba398	User	USER_LOGGED_IN	User	24e598b1-ee10-457d-83bc-122a7e1ba398	\N	::1	2026-10-08 14:23:02.348+03	\N
a7242119-e958-49f0-9478-313a378a187b	24e598b1-ee10-457d-83bc-122a7e1ba398	User	BOOKING_CREATED	Booking	4236a14f-fe34-413a-b3e8-9d855720b6bb	{"flightNumber": "NV202", "bookingReference": "NVAFAY5F"}	\N	2026-10-08 14:23:47.662+03	4236a14f-fe34-413a-b3e8-9d855720b6bb
b4714027-d191-4ca6-9dfa-a60d235ae66f	24e598b1-ee10-457d-83bc-122a7e1ba398	User	SEAT_HELD	Booking	4236a14f-fe34-413a-b3e8-9d855720b6bb	{"holdCount": 1, "seatNumbers": ["4C"], "flightNumber": "NV202", "bookingReference": "NVAFAY5F"}	\N	2026-10-08 14:23:47.665+03	4236a14f-fe34-413a-b3e8-9d855720b6bb
1f2630ff-a39f-4cc0-a3e1-6fd2bb743494	24e598b1-ee10-457d-83bc-122a7e1ba398	User	PAYMENT_INTENT_CREATED	Payment	1c58a475-2167-4deb-bf23-838aa8f16ba9	{"paymentId": "1c58a475-2167-4deb-bf23-838aa8f16ba9", "providerStatus": "requires_payment_method", "bookingReference": "NVAFAY5F", "providerReference": "pi_3UOFTnRplmQkGUx513KSzkRO"}	\N	2026-10-08 14:27:19.228+03	4236a14f-fe34-413a-b3e8-9d855720b6bb
daa5f987-816a-4987-85ef-9b7b08338e05	\N	System	PAYMENT_SUCCEEDED	Payment	1c58a475-2167-4deb-bf23-838aa8f16ba9	{"via": "retrieve", "paymentId": "1c58a475-2167-4deb-bf23-838aa8f16ba9", "transitioned": true, "providerReference": "pi_3UOFTnRplmQkGUx513KSzkRO"}	\N	2026-10-08 14:28:41.655+03	4236a14f-fe34-413a-b3e8-9d855720b6bb
1735d8a9-2598-4068-9993-3d44662290ac	\N	System	BOOKING_CONFIRMED	Booking	4236a14f-fe34-413a-b3e8-9d855720b6bb	{"via": "retrieve", "paymentId": "1c58a475-2167-4deb-bf23-838aa8f16ba9", "bookingReference": "NVAFAY5F"}	\N	2026-10-08 14:28:41.665+03	4236a14f-fe34-413a-b3e8-9d855720b6bb
0ca5b57d-b065-4962-bd17-958ad9230241	\N	System	SEAT_HOLD_CONVERTED	Booking	4236a14f-fe34-413a-b3e8-9d855720b6bb	{"holdCount": 1, "seatNumbers": ["4C"], "bookingReference": "NVAFAY5F"}	\N	2026-10-08 14:28:41.672+03	4236a14f-fe34-413a-b3e8-9d855720b6bb
6678dc1b-ee27-40f6-81ce-c7cf7fd1e1b3	24e598b1-ee10-457d-83bc-122a7e1ba398	User	LOGOUT	Session	144228e4-07d8-4c56-afde-50aa0ef6365f	\N	\N	2026-10-08 14:30:19.582+03	\N
b2ed143c-ed9a-4b56-bb2b-5df6e979dde0	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	USER_LOGGED_IN	User	acdd78f6-9c1a-4ee8-9670-69422e336fad	\N	::1	2026-10-08 14:30:30.959+03	\N
3a920aed-66db-41df-b808-46f7aea67d3f	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	LOGOUT	Session	73415f80-fc2e-4f79-be73-f8c7c9e346fe	\N	\N	2026-10-08 14:30:45.461+03	\N
a32e4481-6e24-4ea7-89a4-74e570bb75c1	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-08 14:30:53.458+03	\N
9eb53d7c-d751-44fb-b3ff-c3bf8713a8bc	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Staff	OFFER_HARD_DELETED	Offer	8f5064ca-eb76-48b6-8c3e-99d5bbca6f91	{"title": "Summer 2027 Sneak Preview"}	\N	2026-10-08 14:31:37.149+03	\N
51a2b662-7542-4420-8bb1-7188503eff16	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	eeb2b4cf-9180-4d05-af66-2b8fc60a196d	\N	\N	2026-10-08 14:32:39.417+03	\N
51659dc9-fec1-4b0a-99bc-153d90f40e2f	24e598b1-ee10-457d-83bc-122a7e1ba398	User	USER_LOGGED_IN	User	24e598b1-ee10-457d-83bc-122a7e1ba398	\N	::1	2026-10-08 14:32:51.134+03	\N
713da099-6c2a-428e-8ffd-7636209c69f9	24e598b1-ee10-457d-83bc-122a7e1ba398	User	LOGOUT	Session	44173165-5b9b-4423-ac19-3d94aeb50bf0	\N	\N	2026-10-08 14:37:38.186+03	\N
68a73ef4-17bf-40cd-8ae5-a65e8dc547f8	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-08 14:43:01.947+03	\N
4e2fb3c2-d710-41b6-87ca-ed574d67a9c7	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	BOOKING_CREATED	Booking	802d1dac-67ac-44d9-a153-a5b6036fc90f	{"flightNumber": "NV200", "bookingReference": "NVX2C72K"}	\N	2026-10-08 14:55:42.383+03	802d1dac-67ac-44d9-a153-a5b6036fc90f
27055cf4-c459-4886-8be5-5e1085b4fc30	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	SEAT_HELD	Booking	802d1dac-67ac-44d9-a153-a5b6036fc90f	{"holdCount": 1, "seatNumbers": ["4B"], "flightNumber": "NV200", "bookingReference": "NVX2C72K"}	\N	2026-10-08 14:55:42.457+03	802d1dac-67ac-44d9-a153-a5b6036fc90f
19810586-e248-4d73-9614-df45a90a67cf	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	PAYMENT_INTENT_CREATED	Payment	e95cc36d-401d-47a5-a2c2-5a88349683d4	{"paymentId": "e95cc36d-401d-47a5-a2c2-5a88349683d4", "providerStatus": "requires_payment_method", "bookingReference": "NVX2C72K", "providerReference": "pi_3UOFvLRplmQkGUx51md6EALT"}	\N	2026-10-08 14:55:46.953+03	802d1dac-67ac-44d9-a153-a5b6036fc90f
ddf06784-635f-4bf0-8eff-ec1a3ce2e5ad	\N	System	PAYMENT_SUCCEEDED	Payment	e95cc36d-401d-47a5-a2c2-5a88349683d4	{"via": "retrieve", "paymentId": "e95cc36d-401d-47a5-a2c2-5a88349683d4", "transitioned": true, "providerReference": "pi_3UOFvLRplmQkGUx51md6EALT"}	\N	2026-10-08 14:56:31.417+03	802d1dac-67ac-44d9-a153-a5b6036fc90f
ba9eaeb0-f3a2-4a1a-aba1-4ca73da05358	\N	System	BOOKING_CONFIRMED	Booking	802d1dac-67ac-44d9-a153-a5b6036fc90f	{"via": "retrieve", "paymentId": "e95cc36d-401d-47a5-a2c2-5a88349683d4", "bookingReference": "NVX2C72K"}	\N	2026-10-08 14:56:31.419+03	802d1dac-67ac-44d9-a153-a5b6036fc90f
bbf1e529-383a-4656-86fc-85997add8325	\N	System	SEAT_HOLD_CONVERTED	Booking	802d1dac-67ac-44d9-a153-a5b6036fc90f	{"holdCount": 1, "seatNumbers": ["4B"], "bookingReference": "NVX2C72K"}	\N	2026-10-08 14:56:31.421+03	802d1dac-67ac-44d9-a153-a5b6036fc90f
84fe45e4-b689-41e5-880d-c897ce49323c	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	261397ee-efbd-44d7-834e-1f90c758dbae	\N	\N	2026-10-08 14:56:58.647+03	\N
89016ff7-9967-4a61-8edc-5ee3e5f0a6ff	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-08 14:57:08.544+03	\N
8cb8808f-e10e-4a6f-84a1-2b61ab6042cb	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Staff	REFUND_COMPLETED	Refund	80552ee7-096d-4bb5-9767-3fb9bdd2e7e6	{"amount": 1547.9, "reason": "not accepted for booking", "currency": "EUR", "refundId": "80552ee7-096d-4bb5-9767-3fb9bdd2e7e6", "paymentId": "e95cc36d-401d-47a5-a2c2-5a88349683d4", "bookingReference": "NVX2C72K", "providerReference": "re_3UOFvLRplmQkGUx510utaHcA"}	\N	2026-10-08 14:58:31.565+03	802d1dac-67ac-44d9-a153-a5b6036fc90f
ec7223bb-d104-40e3-8736-4bb2149f8781	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	e56d9858-5f2a-4f21-a6bb-21fec4f42e7f	\N	\N	2026-10-08 14:58:43.984+03	\N
4ad77361-92d8-4146-9b62-3257fee12b06	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-08 14:59:01.551+03	\N
575422ed-450f-4d55-8626-855ce3aa1dbd	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	7b8f6547-434f-46e0-949c-047a71b4dc7e	\N	\N	2026-10-08 15:00:41.362+03	\N
ed47977d-1c60-45d6-84d7-f1cddbbf1e58	c420004f-c75c-4c25-947e-d9d0e6c3aa44	User	USER_REGISTERED	User	c420004f-c75c-4c25-947e-d9d0e6c3aa44	\N	\N	2026-10-08 15:02:25.77+03	\N
d5666d06-6236-4831-b4df-36f4e4c74980	c420004f-c75c-4c25-947e-d9d0e6c3aa44	User	EMAIL_VERIFIED	User	c420004f-c75c-4c25-947e-d9d0e6c3aa44	\N	::1	2026-10-08 15:02:54.332+03	\N
8885ca8e-98df-46cd-9d00-d8a10e221382	c420004f-c75c-4c25-947e-d9d0e6c3aa44	User	USER_LOGGED_IN	User	c420004f-c75c-4c25-947e-d9d0e6c3aa44	\N	::1	2026-10-08 15:03:34.473+03	\N
24c1d2a3-b779-4717-aa77-600c306c33c2	c420004f-c75c-4c25-947e-d9d0e6c3aa44	User	LOGOUT	Session	2e728919-9b64-44ea-b96a-f729cf1ea89b	\N	\N	2026-10-08 15:11:37.228+03	\N
229c973c-b53c-45e1-af65-2251a7e42634	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-08 15:12:02.99+03	\N
d1062ea3-c4ef-44e0-9cea-c797300cfffd	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Staff	BAGGAGE_EVENT_RECORDED	Baggage	7d77f508-a2d0-46a2-8438-d9974cde5a86	{"location": "JFK", "eventType": "DELIVERED", "tagNumber": "NV00000002"}	\N	2026-10-08 15:12:39.406+03	\N
b76b0b5f-cbdb-470c-a44f-1b2e57dc9b96	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	110dea84-f1b0-48c7-8301-b250e0fffa50	\N	\N	2026-10-08 15:15:40.644+03	\N
8174ce42-2682-431c-ace9-45a5b52aaa07	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-08 15:15:50.467+03	\N
125ac97e-7d45-46d6-a14c-05440830610b	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	7240508f-aa33-4b96-842e-b78e1eee1988	\N	\N	2026-10-08 15:32:23.549+03	\N
a25b5663-739e-4d0b-b7f5-18d23c58e04a	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-08 15:32:48.4+03	\N
ddb00abc-7f5a-4b47-9985-f592eba51260	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	928d9638-6520-40e6-8d0b-94ddf26c8e20	\N	\N	2026-10-08 15:34:13.19+03	\N
2d1dc355-f591-4490-8691-1756e22d2398	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-08 15:34:20.699+03	\N
3167bb39-0720-4ba2-a951-9d09a56f49c3	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-08 15:35:48.747+03	\N
59d5fe49-5264-414b-be28-e580d7e353cf	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	b98aef35-85f0-463f-8d93-b9793df48f6c	\N	\N	2026-10-08 15:37:25.715+03	\N
09eaaa82-72b9-4e52-bd22-0aeafea7b69a	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-08 15:37:34.545+03	\N
1e6d6189-a567-4b70-8e0d-702ba28475ad	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	c27b810f-714a-49a4-90a7-453e3ace96fb	\N	\N	2026-10-08 15:38:19.418+03	\N
f0cb1b4f-aac1-4bc3-bbe7-db6f8a3f0943	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-08 15:38:23.626+03	\N
3873ec3e-92f0-40c0-8135-5b826fac4bd1	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-08 17:35:31.832+03	\N
ff761434-9748-4879-a352-a044ba209a89	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	0068b910-638f-423e-847e-bc972f32b25f	\N	\N	2026-10-08 17:35:42.249+03	\N
d9b1ecc3-4785-455b-afc2-fa548c8d0363	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-08 17:35:49.599+03	\N
e17b8a6a-cc08-4e76-8847-6532d221a945	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	BOOKING_CREATED	Booking	108319d0-5696-4498-9c66-d05e5b1b2f99	{"flightNumber": "NV100", "bookingReference": "NVKM2XVU"}	\N	2026-10-08 17:37:22.275+03	108319d0-5696-4498-9c66-d05e5b1b2f99
40b0144c-4527-4c8b-a412-0b95781957e6	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	SEAT_HELD	Booking	108319d0-5696-4498-9c66-d05e5b1b2f99	{"holdCount": 1, "seatNumbers": ["2B"], "flightNumber": "NV100", "bookingReference": "NVKM2XVU"}	\N	2026-10-08 17:37:22.279+03	108319d0-5696-4498-9c66-d05e5b1b2f99
cd5416fa-186a-4331-89c8-438903d521a3	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	PAYMENT_INTENT_CREATED	Payment	ef3ad2c6-d2e1-49f5-a134-e02166afc5b9	{"paymentId": "ef3ad2c6-d2e1-49f5-a134-e02166afc5b9", "providerStatus": "requires_payment_method", "bookingReference": "NVKM2XVU", "providerReference": "pi_3UOIRnRplmQkGUx50oepBedb"}	\N	2026-10-08 17:37:26.334+03	108319d0-5696-4498-9c66-d05e5b1b2f99
d810d8e7-f2da-4b03-a6ed-1b6917ad7ad0	\N	System	PAYMENT_SUCCEEDED	Payment	ef3ad2c6-d2e1-49f5-a134-e02166afc5b9	{"via": "retrieve", "paymentId": "ef3ad2c6-d2e1-49f5-a134-e02166afc5b9", "transitioned": true, "providerReference": "pi_3UOIRnRplmQkGUx50oepBedb"}	\N	2026-10-08 17:38:03.269+03	108319d0-5696-4498-9c66-d05e5b1b2f99
04662158-ca45-48e9-a8d3-4f949e2bbd28	\N	System	BOOKING_CONFIRMED	Booking	108319d0-5696-4498-9c66-d05e5b1b2f99	{"via": "retrieve", "paymentId": "ef3ad2c6-d2e1-49f5-a134-e02166afc5b9", "bookingReference": "NVKM2XVU"}	\N	2026-10-08 17:38:03.27+03	108319d0-5696-4498-9c66-d05e5b1b2f99
23484016-b46e-4a34-96fc-0e95b0ba0de2	\N	System	SEAT_HOLD_CONVERTED	Booking	108319d0-5696-4498-9c66-d05e5b1b2f99	{"holdCount": 1, "seatNumbers": ["2B"], "bookingReference": "NVKM2XVU"}	\N	2026-10-08 17:38:03.271+03	108319d0-5696-4498-9c66-d05e5b1b2f99
5e120392-d6f0-4702-bf17-6dfe9e48fc09	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	CANCELLATION_REQUESTED	Booking	108319d0-5696-4498-9c66-d05e5b1b2f99	{"reason": "need cancel booking", "bookingReference": "NVKM2XVU"}	\N	2026-10-08 17:38:34.236+03	108319d0-5696-4498-9c66-d05e5b1b2f99
0eb81ae6-e544-44ca-9397-ae450953569b	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	4a03db3b-73a9-435a-8d13-ce58a3d3e1ee	\N	\N	2026-10-08 17:38:40.922+03	\N
aa1cd3dd-bc53-4b33-8daf-c1b6ac6af1dc	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-08 17:38:50.604+03	\N
9ac96143-cea3-4ddf-a11b-a2d28e427916	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Staff	CANCELLATION_REQUEST_APPROVED	CancellationRequest	0f462bf9-7e97-4404-99ab-a6acec077731	{"reason": "NON_REFUNDABLE_FARE", "bookingReference": "NVKM2XVU"}	\N	2026-10-08 17:39:23.41+03	108319d0-5696-4498-9c66-d05e5b1b2f99
f7aec179-312f-4ae7-8a00-68993c9c559a	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Staff	BOOKING_CANCELLED	Booking	108319d0-5696-4498-9c66-d05e5b1b2f99	{"reason": "NON_REFUNDABLE_FARE", "bookingReference": "NVKM2XVU", "refundPercentage": 0, "releasedSeatCount": 1}	\N	2026-10-08 17:39:23.413+03	108319d0-5696-4498-9c66-d05e5b1b2f99
8ffbc44f-e48f-44a3-b1cd-3b293aa8ad76	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Staff	REFUND_COMPLETED	Refund	bc869b01-7578-4d07-8cca-7a74e7318c7f	{"amount": 2780, "reason": null, "currency": "EUR", "refundId": "bc869b01-7578-4d07-8cca-7a74e7318c7f", "paymentId": "ef3ad2c6-d2e1-49f5-a134-e02166afc5b9", "bookingReference": "NVKM2XVU", "providerReference": "re_3UOIRnRplmQkGUx50L9ijXaR"}	\N	2026-10-08 17:39:59.624+03	108319d0-5696-4498-9c66-d05e5b1b2f99
ee3e4c91-f8dc-4b06-ac53-aa8006766dd1	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	df5c3edb-2655-4388-96ed-22afd34da72d	\N	\N	2026-10-08 17:40:08.512+03	\N
11e89427-e5ed-43a1-9115-3e62dc2177b7	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-08 17:40:14.756+03	\N
452b4e7f-33a1-4651-98a6-34933a5ecda5	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	CANCELLATION_REQUESTED	Booking	802d1dac-67ac-44d9-a153-a5b6036fc90f	{"reason": "NVX2C72K", "bookingReference": "NVX2C72K"}	\N	2026-10-08 17:41:26.544+03	802d1dac-67ac-44d9-a153-a5b6036fc90f
b3b89fc3-638f-4bef-9b02-9ca29fa6a619	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	077ea9ec-0a2d-4d59-983c-420eaa9327c4	\N	\N	2026-10-08 17:41:33.133+03	\N
045d45fd-850e-43dc-beb6-dcbbd73fa199	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-08 17:41:44.245+03	\N
4ace98f1-e692-4f82-b18e-aeabe583c666	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Staff	OFFER_HARD_DELETED	Offer	a10cf399-6fb5-44fd-b51d-5898cad5ba39	{"title": "Autumn Flash Sale"}	\N	2026-10-08 17:42:42.16+03	\N
36db064d-4c6c-4c37-a90d-d54ab8ea0217	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	4157eb17-8e53-4613-82ce-6c4e502628bd	\N	\N	2026-10-12 00:24:50.642+03	\N
e5997c90-6a2b-4384-8788-0a15341f29fc	24e598b1-ee10-457d-83bc-122a7e1ba398	User	USER_LOGGED_IN	User	24e598b1-ee10-457d-83bc-122a7e1ba398	\N	::1	2026-10-12 00:25:01.267+03	\N
4619d74f-147a-4db5-bb0a-cf72143d8b54	24e598b1-ee10-457d-83bc-122a7e1ba398	User	BOOKING_CREATED	Booking	6a18720e-6788-4b8f-b236-3cae380f8143	{"flightNumber": "NV100", "bookingReference": "NVPA4RSL"}	\N	2026-10-12 00:27:08.113+03	6a18720e-6788-4b8f-b236-3cae380f8143
5046e22f-948e-48e9-a0b8-68141957188c	24e598b1-ee10-457d-83bc-122a7e1ba398	User	SEAT_HELD	Booking	6a18720e-6788-4b8f-b236-3cae380f8143	{"holdCount": 1, "seatNumbers": ["3D"], "flightNumber": "NV100", "bookingReference": "NVPA4RSL"}	\N	2026-10-12 00:27:08.117+03	6a18720e-6788-4b8f-b236-3cae380f8143
946bdf6f-c817-44db-890b-d6cff38cd556	24e598b1-ee10-457d-83bc-122a7e1ba398	User	PAYMENT_INTENT_CREATED	Payment	f26fb2a2-c867-4786-b98c-58b0fd043258	{"paymentId": "f26fb2a2-c867-4786-b98c-58b0fd043258", "providerStatus": "requires_payment_method", "bookingReference": "NVPA4RSL", "providerReference": "pi_3UPUHGRplmQkGUx506CJGFHX"}	\N	2026-10-12 00:27:31.52+03	6a18720e-6788-4b8f-b236-3cae380f8143
2857a94f-c126-48a7-a1d9-09e2f775a9ca	\N	System	PAYMENT_SUCCEEDED	Payment	f26fb2a2-c867-4786-b98c-58b0fd043258	{"via": "retrieve", "paymentId": "f26fb2a2-c867-4786-b98c-58b0fd043258", "transitioned": true, "providerReference": "pi_3UPUHGRplmQkGUx506CJGFHX"}	\N	2026-10-12 00:28:25.275+03	6a18720e-6788-4b8f-b236-3cae380f8143
9b79ddcc-d0a5-40e3-82a3-7199c3bc733f	\N	System	BOOKING_CONFIRMED	Booking	6a18720e-6788-4b8f-b236-3cae380f8143	{"via": "retrieve", "paymentId": "f26fb2a2-c867-4786-b98c-58b0fd043258", "bookingReference": "NVPA4RSL"}	\N	2026-10-12 00:28:25.279+03	6a18720e-6788-4b8f-b236-3cae380f8143
747f0c1f-2682-4e4b-8a7a-fd9b6d8e4f7c	\N	System	SEAT_HOLD_CONVERTED	Booking	6a18720e-6788-4b8f-b236-3cae380f8143	{"holdCount": 1, "seatNumbers": ["3D"], "bookingReference": "NVPA4RSL"}	\N	2026-10-12 00:28:25.28+03	6a18720e-6788-4b8f-b236-3cae380f8143
a465e3b3-f4e2-4012-8a60-3de26aa33306	24e598b1-ee10-457d-83bc-122a7e1ba398	User	LOGOUT	Session	7ac38149-9944-4de3-894e-3a8f0a8cda12	\N	\N	2026-10-12 00:29:20.843+03	\N
6053e286-612f-4b15-92bc-82d4b7ee3e0a	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-12 00:29:32.712+03	\N
57a77108-6a60-4000-9824-89377b2c11a3	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	6286ee12-aa18-4fd7-aef8-a440f2f2a6f3	\N	\N	2026-10-12 00:31:47.361+03	\N
201f16d2-de53-4581-8c8f-318226edf733	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	USER_LOGGED_IN	User	acdd78f6-9c1a-4ee8-9670-69422e336fad	\N	::1	2026-10-12 11:56:26.014+03	\N
d9f7f8ee-4b7d-4d10-8622-36b4617628e8	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	LOGOUT	Session	fc994aed-7116-45e7-8f9a-c82fb0176a25	\N	\N	2026-10-12 11:56:26.061+03	\N
ee6ee45b-2d69-4b28-9d76-29390b6b2b2a	24e598b1-ee10-457d-83bc-122a7e1ba398	User	USER_LOGGED_IN	User	24e598b1-ee10-457d-83bc-122a7e1ba398	\N	::1	2026-10-12 11:56:38.481+03	\N
7962c04c-4feb-46ae-8a06-c690d264eb49	24e598b1-ee10-457d-83bc-122a7e1ba398	User	BOOKING_CREATED	Booking	1c01d63f-133c-4aa4-8644-83787c65601d	{"flightNumber": "NV202", "bookingReference": "NV7W4WJL"}	\N	2026-10-12 11:59:31.532+03	1c01d63f-133c-4aa4-8644-83787c65601d
9f124cff-29f8-4978-81a6-b8a617d83459	24e598b1-ee10-457d-83bc-122a7e1ba398	User	SEAT_HELD	Booking	1c01d63f-133c-4aa4-8644-83787c65601d	{"holdCount": 1, "seatNumbers": ["2B"], "flightNumber": "NV202", "bookingReference": "NV7W4WJL"}	\N	2026-10-12 11:59:31.536+03	1c01d63f-133c-4aa4-8644-83787c65601d
7789936b-2e98-45e3-bdb1-89dd62879af7	24e598b1-ee10-457d-83bc-122a7e1ba398	User	PAYMENT_INTENT_CREATED	Payment	30ac02c1-2afc-4fdd-b902-b6c5befa8f64	{"paymentId": "30ac02c1-2afc-4fdd-b902-b6c5befa8f64", "providerStatus": "requires_payment_method", "bookingReference": "NV7W4WJL", "providerReference": "pi_3UPf5TRplmQkGUx510x1HO8B"}	\N	2026-10-12 12:00:03.761+03	1c01d63f-133c-4aa4-8644-83787c65601d
fce50505-72a0-44aa-8b10-bcaf0a6d001a	\N	System	PAYMENT_SUCCEEDED	Payment	30ac02c1-2afc-4fdd-b902-b6c5befa8f64	{"via": "retrieve", "paymentId": "30ac02c1-2afc-4fdd-b902-b6c5befa8f64", "transitioned": true, "providerReference": "pi_3UPf5TRplmQkGUx510x1HO8B"}	\N	2026-10-12 12:05:18.764+03	1c01d63f-133c-4aa4-8644-83787c65601d
46b32cce-2f59-425e-b032-d8ce9ddcdf09	\N	System	BOOKING_CONFIRMED	Booking	1c01d63f-133c-4aa4-8644-83787c65601d	{"via": "retrieve", "paymentId": "30ac02c1-2afc-4fdd-b902-b6c5befa8f64", "bookingReference": "NV7W4WJL"}	\N	2026-10-12 12:05:18.768+03	1c01d63f-133c-4aa4-8644-83787c65601d
f95369cd-2d84-458a-bc28-d7bbc37fecc3	\N	System	SEAT_HOLD_CONVERTED	Booking	1c01d63f-133c-4aa4-8644-83787c65601d	{"holdCount": 1, "seatNumbers": ["2B"], "bookingReference": "NV7W4WJL"}	\N	2026-10-12 12:05:18.77+03	1c01d63f-133c-4aa4-8644-83787c65601d
422e7fa0-a8bf-4fa5-aa2b-eb8f1f0afeaa	24e598b1-ee10-457d-83bc-122a7e1ba398	User	CHECK_IN_COMPLETED	Booking	6a18720e-6788-4b8f-b236-3cae380f8143	{"checkInCount": 1, "flightNumber": "NV100", "bookingReference": "NVPA4RSL"}	\N	2026-10-12 12:29:55.987+03	6a18720e-6788-4b8f-b236-3cae380f8143
8c277497-89b0-4a73-a796-774ad0eeced6	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	USER_LOGGED_IN	User	acdd78f6-9c1a-4ee8-9670-69422e336fad	\N	::1	2026-10-12 13:44:45.462+03	\N
e65b7450-afd6-435f-9fb9-1c570d509821	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	LOGOUT	Session	25461f5f-312e-4eb3-8054-1e2519818bd4	\N	\N	2026-10-12 13:44:45.514+03	\N
9f37a8f0-ab81-440b-8ca4-9223498298bf	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	USER_LOGGED_IN	User	acdd78f6-9c1a-4ee8-9670-69422e336fad	\N	::1	2026-10-12 13:44:46.486+03	\N
c8677a8f-3654-4e4d-a588-13c48f55d67a	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	LOGOUT	Session	f79eb197-e32e-43ee-8109-81ceac55e87e	\N	\N	2026-10-12 13:44:46.511+03	\N
bb74ee6a-e147-4939-ac71-6cc8830cafb6	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	USER_LOGGED_IN	User	acdd78f6-9c1a-4ee8-9670-69422e336fad	\N	::1	2026-10-12 13:45:20.386+03	\N
e8cee55a-b583-4680-b26c-b605b0421bbd	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	LOGOUT	Session	13ecb651-e694-42c1-a172-38f9f0d4c6d3	\N	\N	2026-10-12 13:45:20.417+03	\N
c3f91901-e507-4fd1-86cd-0a1939575cbd	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	USER_LOGGED_IN	User	acdd78f6-9c1a-4ee8-9670-69422e336fad	\N	::1	2026-10-12 13:45:20.928+03	\N
72dbfbe7-96d1-4f87-beb4-4ce9e5282af9	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	LOGOUT	Session	6538a876-d86b-4a77-9021-3dca20e63734	\N	\N	2026-10-12 13:45:20.951+03	\N
52d4f5c0-69d0-4b8b-a1fb-84b3a7c40a07	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	USER_LOGGED_IN	User	acdd78f6-9c1a-4ee8-9670-69422e336fad	\N	::1	2026-10-12 14:25:07.259+03	\N
4c4b1e42-fbdb-4ede-ba9d-210c59f9bb1f	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	LOGOUT	Session	9a69d730-8085-407b-a1df-c34a6b08069a	\N	\N	2026-10-12 14:25:07.303+03	\N
c25ecf10-5630-4b4b-bdc3-d722e7b04731	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	USER_LOGGED_IN	User	acdd78f6-9c1a-4ee8-9670-69422e336fad	\N	::1	2026-10-12 14:25:08.119+03	\N
94345c80-dced-468d-9f46-da4a17615e5e	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	LOGOUT	Session	51714ba5-3c4f-4538-a6ed-e00d5a455ca4	\N	\N	2026-10-12 14:25:08.143+03	\N
531aa85e-d445-4cb8-8811-0b5c22572884	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	USER_LOGGED_IN	User	acdd78f6-9c1a-4ee8-9670-69422e336fad	\N	::1	2026-10-12 14:25:38.469+03	\N
751c0e89-4928-452b-ba84-ef1bfb1c15c3	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	LOGOUT	Session	028084fe-24b4-43f8-8b84-493cb4f380e6	\N	\N	2026-10-12 14:25:38.494+03	\N
367d2b3b-c9d3-4767-b247-d82be1b42ce7	24e598b1-ee10-457d-83bc-122a7e1ba398	User	USER_LOGGED_IN	User	24e598b1-ee10-457d-83bc-122a7e1ba398	\N	::1	2026-10-12 14:25:49.688+03	\N
afada83f-949f-4d4d-bcb2-8e34859effdc	24e598b1-ee10-457d-83bc-122a7e1ba398	User	CHECK_IN_COMPLETED	Booking	1c01d63f-133c-4aa4-8644-83787c65601d	{"checkInCount": 1, "flightNumber": "NV202", "bookingReference": "NV7W4WJL"}	\N	2026-10-12 14:28:46.965+03	1c01d63f-133c-4aa4-8644-83787c65601d
aa1545d4-b9ed-4ab2-8f76-c0e4f375e15a	24e598b1-ee10-457d-83bc-122a7e1ba398	User	LOGOUT	Session	4d283b71-2922-41a4-9ca2-7fc06b46cc21	\N	\N	2026-10-12 14:34:09.458+03	\N
22be8022-2f55-4027-b0bf-9c6b01161720	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-12 14:35:05.787+03	\N
46a8634b-2511-4fb4-a46f-36e8b248bae4	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Staff	CANCELLATION_REQUEST_REJECTED	CancellationRequest	5c14b18b-aa03-4dad-a444-b0bc03cca2d4	{"bookingReference": "NVX2C72K"}	\N	2026-10-12 14:43:11.551+03	802d1dac-67ac-44d9-a153-a5b6036fc90f
73e2affc-e7f0-44a5-83f9-4c85a6a62351	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	2ebd2973-a219-483b-a9b7-5e58de1bc9d5	\N	\N	2026-10-12 15:04:51.407+03	\N
d3bae42b-56e9-4eac-821f-084cc8c5f6ca	c420004f-c75c-4c25-947e-d9d0e6c3aa44	User	USER_LOGGED_IN	User	c420004f-c75c-4c25-947e-d9d0e6c3aa44	\N	::1	2026-10-12 15:05:13.795+03	\N
49f98f9c-420e-426b-9a0e-a13d94fd3ef3	c420004f-c75c-4c25-947e-d9d0e6c3aa44	User	BOOKING_CREATED	Booking	e27218a4-ec6a-4801-84f1-3207b73af8aa	{"flightNumber": "NV103", "bookingReference": "NVE4LUZL"}	\N	2026-10-12 15:06:45.759+03	e27218a4-ec6a-4801-84f1-3207b73af8aa
696929ee-caa7-4684-a1bb-8a46a93b2f70	c420004f-c75c-4c25-947e-d9d0e6c3aa44	User	SEAT_HELD	Booking	e27218a4-ec6a-4801-84f1-3207b73af8aa	{"holdCount": 1, "seatNumbers": ["6D"], "flightNumber": "NV103", "bookingReference": "NVE4LUZL"}	\N	2026-10-12 15:06:45.763+03	e27218a4-ec6a-4801-84f1-3207b73af8aa
9fac9fb7-1255-46d8-91cb-5413773f986d	c420004f-c75c-4c25-947e-d9d0e6c3aa44	User	PAYMENT_INTENT_CREATED	Payment	fe694828-21ff-494c-a3c5-d2b787b7dfae	{"paymentId": "fe694828-21ff-494c-a3c5-d2b787b7dfae", "providerStatus": "requires_payment_method", "bookingReference": "NVE4LUZL", "providerReference": "pi_3UPi0ERplmQkGUx514l9pYOl"}	\N	2026-10-12 15:06:50.267+03	e27218a4-ec6a-4801-84f1-3207b73af8aa
6efff083-1236-4e34-993b-a3aa23dce7fc	\N	System	PAYMENT_SUCCEEDED	Payment	fe694828-21ff-494c-a3c5-d2b787b7dfae	{"via": "retrieve", "paymentId": "fe694828-21ff-494c-a3c5-d2b787b7dfae", "transitioned": true, "providerReference": "pi_3UPi0ERplmQkGUx514l9pYOl"}	\N	2026-10-12 15:08:13.557+03	e27218a4-ec6a-4801-84f1-3207b73af8aa
3b350d4b-92b6-4ab8-8a5c-db6736c6d5be	\N	System	BOOKING_CONFIRMED	Booking	e27218a4-ec6a-4801-84f1-3207b73af8aa	{"via": "retrieve", "paymentId": "fe694828-21ff-494c-a3c5-d2b787b7dfae", "bookingReference": "NVE4LUZL"}	\N	2026-10-12 15:08:13.56+03	e27218a4-ec6a-4801-84f1-3207b73af8aa
e7970691-d37e-4f5d-9394-734fe3d413aa	\N	System	SEAT_HOLD_CONVERTED	Booking	e27218a4-ec6a-4801-84f1-3207b73af8aa	{"holdCount": 1, "seatNumbers": ["6D"], "bookingReference": "NVE4LUZL"}	\N	2026-10-12 15:08:13.561+03	e27218a4-ec6a-4801-84f1-3207b73af8aa
39a56549-99f3-49c0-b16c-a8cd68cad5d7	c420004f-c75c-4c25-947e-d9d0e6c3aa44	User	CHECK_IN_COMPLETED	Booking	e27218a4-ec6a-4801-84f1-3207b73af8aa	{"checkInCount": 1, "flightNumber": "NV103", "bookingReference": "NVE4LUZL"}	\N	2026-10-12 15:09:28.844+03	e27218a4-ec6a-4801-84f1-3207b73af8aa
8ef9c40c-a5b7-4dab-812c-153fedef4474	c420004f-c75c-4c25-947e-d9d0e6c3aa44	User	LOGOUT	Session	929bd570-5f2a-48d2-9d50-70b0ea89e425	\N	\N	2026-10-12 15:15:27.449+03	\N
aca1d860-b928-4d5b-9edd-7b9729b7c4d8	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-12 15:15:40.034+03	\N
c4db5eab-e4f9-4d1f-a8c6-a30ebfde4372	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	2dcb2be6-5d43-47f4-835c-e7fd3cd6f377	\N	\N	2026-10-12 15:16:14.835+03	\N
4eff559e-6826-4670-ba1f-6f4241981bd7	24e598b1-ee10-457d-83bc-122a7e1ba398	User	USER_LOGGED_IN	User	24e598b1-ee10-457d-83bc-122a7e1ba398	\N	::1	2026-10-12 15:16:23.074+03	\N
00c02ae9-4632-4a74-9035-b0b186bdf114	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-12 15:19:49.726+03	\N
f45c3e52-b13a-453e-89fd-f7d22ac09ded	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-12 15:19:58.037+03	\N
e9d9601f-7da2-4ffc-a6c8-bf231e642456	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-12 15:20:15.333+03	\N
d9633359-3dc4-47c5-8e5f-6d29eb0540ab	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-12 15:21:48.117+03	\N
34cce6e2-d8fd-48d6-a529-03f1855e524d	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-12 15:28:33.636+03	\N
de9d90bd-9cf7-4aa3-bd6a-25f3fc39952d	24e598b1-ee10-457d-83bc-122a7e1ba398	User	LOGOUT	Session	ac0b21be-fb1e-4a13-8587-ce33cdd42843	\N	\N	2026-10-12 15:30:53.065+03	\N
5d1392b6-2b7b-4a16-b705-c57e55966460	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-12 15:31:08.294+03	\N
4b694dc6-34e4-49c2-91fc-477b4d17928d	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Staff	OFFER_DELETED	Offer	e2d4c8f8-85e1-4786-842e-b99ec3bb8d7a	{"title": "London City Break"}	\N	2026-10-12 15:32:43.071+03	\N
31d80975-1824-450e-8d61-ba7fda88e8c1	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Staff	OFFER_HARD_DELETED	Offer	e2d4c8f8-85e1-4786-842e-b99ec3bb8d7a	{"title": "London City Break"}	\N	2026-10-12 15:33:32.981+03	\N
285d3270-3ec2-4639-b4d4-c88b834d72dd	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Staff	OFFER_DELETED	Offer	32cbb37d-3afd-4008-8895-c2642958e062	{"title": "Transatlantic Business"}	\N	2026-10-12 15:33:43.747+03	\N
5c4a5e1d-6db6-4fd0-a33b-200bdfcfe75e	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	297f24e5-1de9-4d54-a802-5b5df75575e9	\N	\N	2026-10-12 15:35:46.75+03	\N
41b90155-f460-4370-bc5a-47209682af33	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-12 15:39:19.435+03	\N
b18bf736-88a9-49db-866f-d77c3000fe48	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-12 15:39:30.781+03	\N
14663c6e-5bd6-49bd-ba21-a1a15e7574d4	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-12 15:40:01.834+03	\N
3e1e6a9b-fbfb-4b18-bbbd-4968255455ac	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-12 15:40:13.283+03	\N
5cf88383-abc4-4c78-af6a-efc36e8224cc	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-12 15:40:23.172+03	\N
edc10608-f450-4879-8cd8-52168d031cb7	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-12 15:40:34.344+03	\N
431083f4-4638-42fe-812a-9c6c69c94bb8	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-12 16:01:02.27+03	\N
217c834f-ae16-4386-9023-169f377b76e5	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	53ce01fb-dae5-465a-961c-7abfc1d4994c	\N	\N	2026-10-12 16:30:04.858+03	\N
8e059af0-0fd4-40a0-bc91-438acbe92848	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	USER_LOGGED_IN	User	acdd78f6-9c1a-4ee8-9670-69422e336fad	\N	::1	2026-10-12 16:30:11.173+03	\N
0ffefe38-1c29-4bf6-a51f-d7600da058df	acdd78f6-9c1a-4ee8-9670-69422e336fad	User	LOGOUT	Session	da72f9a0-2f03-4bec-a3e9-b5c45e270ba4	\N	\N	2026-10-12 16:30:11.202+03	\N
4746d643-1fb3-443e-a8be-50a8d1f98dcd	c420004f-c75c-4c25-947e-d9d0e6c3aa44	User	USER_LOGGED_IN	User	c420004f-c75c-4c25-947e-d9d0e6c3aa44	\N	::1	2026-10-12 16:30:19.196+03	\N
519d7575-4d03-498e-b8d5-92f5f5a1de87	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-12 17:25:11.037+03	\N
4ef3dd28-97aa-4fa5-a28e-212472b90402	c420004f-c75c-4c25-947e-d9d0e6c3aa44	User	LOGOUT	Session	822e3883-3ba4-4a5f-a831-1d8a9dac25a5	\N	\N	2026-10-13 14:31:20.88+03	\N
bffcfd4c-18b5-427a-90a6-5c0d8cbef89a	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-13 14:31:36.436+03	\N
77bce0cc-6350-4c67-abb2-879db69fce74	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	bb507bee-f76d-4b6a-8fa2-89dd6696438e	\N	\N	2026-10-13 14:33:16.009+03	\N
0a67a33a-dc4e-4b78-91cb-423c4581b9f1	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-13 14:33:26.515+03	\N
310418f6-55a0-41e6-968b-904e70b3aba7	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	63fc48b8-c187-4557-ab52-52729bc16cd7	\N	\N	2026-10-13 14:47:45.538+03	\N
c7f7d7e6-8c2a-4eab-bd55-c8000c254e09	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-13 14:47:55.073+03	\N
4a1d7e5e-1649-4d9c-9729-7afcff4f0237	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	cb9140e7-ab26-4f9d-a395-ae4b6fcf2f7b	\N	\N	2026-10-13 14:48:21.603+03	\N
9170cbe3-f530-478d-b37d-2873a618b5c9	24e598b1-ee10-457d-83bc-122a7e1ba398	User	USER_LOGGED_IN	User	24e598b1-ee10-457d-83bc-122a7e1ba398	\N	::1	2026-10-13 14:48:26.919+03	\N
05c827f0-ca4c-4a78-9dee-631608cc7134	24e598b1-ee10-457d-83bc-122a7e1ba398	User	LOGOUT	Session	55c1c20c-a1c0-4c15-8e7c-c7da588298be	\N	\N	2026-10-13 15:01:00.916+03	\N
34b3ab9e-d32c-43f1-ba1f-07ed08b8ea64	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-13 15:01:14.897+03	\N
c0a18f12-2dd5-4c9c-a7cb-e951eccbb48c	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	dc51b01c-6514-4d84-b8d3-c1c07eb4f8a4	\N	\N	2026-10-13 15:03:18.625+03	\N
47c2fb01-ac0c-4edd-875b-fb74757b8145	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-13 15:03:39.84+03	\N
b4e2b3a5-d4ce-4bfd-a83c-3343117432a1	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	a7aa14e1-eeb8-4cd2-be06-7b71074914e7	\N	\N	2026-10-13 15:22:25.181+03	\N
f4d13ab9-2111-4068-8b09-3a09778b3de7	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-13 15:22:34.067+03	\N
be561c99-c412-4c72-a24c-45f92f05277d	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	3dadfff0-df8d-46b6-aa9e-a49ebce008b8	\N	\N	2026-10-13 15:24:18.089+03	\N
854f92db-0fb2-4171-90f8-e2a2ff0fbad3	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-13 15:25:20.203+03	\N
48b40e53-e836-4441-a359-160337f14c2a	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	0c527439-5ef1-4fe4-996d-3acebdf4daa6	\N	\N	2026-10-13 15:28:07.74+03	\N
943840cf-7ea4-4f71-aa8f-56ab6c0c822d	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-13 15:28:17.06+03	\N
ab6dcd88-9831-4165-abed-c92d49f7d55b	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	d399af64-3411-4bed-a235-f1471b23f59f	\N	\N	2026-10-13 15:28:17.081+03	\N
2c6160bc-d0c2-4da1-a3e3-d0133cb0ef3d	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-13 15:28:32.941+03	\N
3133aff5-705c-4531-9b1e-172488f6ad9b	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Staff	USER_CREATED	User	96fd724b-f1c4-40f4-a29d-c1fb5dbbd750	{"roleIds": ["6b0d0393-3abb-41fd-bd16-da2875be84a2"]}	\N	2026-10-13 15:33:45.369+03	\N
166fdfa4-7965-466b-b1ae-b6f4a7dc1bc3	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	fdaf3074-a268-45fa-8845-32389d5a485d	\N	\N	2026-10-13 15:33:48.893+03	\N
0cf447b7-c0ca-4c81-96c6-82f6278b5955	96fd724b-f1c4-40f4-a29d-c1fb5dbbd750	User	USER_LOGGED_IN	User	96fd724b-f1c4-40f4-a29d-c1fb5dbbd750	\N	::1	2026-10-13 15:34:00.602+03	\N
0a15d7ee-7cb0-47ba-bb6c-1faf0973fa6f	96fd724b-f1c4-40f4-a29d-c1fb5dbbd750	User	LOGOUT	Session	e2aec66d-10b5-4536-82c1-9c733a145f42	\N	\N	2026-10-13 15:34:42.484+03	\N
6b693e36-aca4-4fc0-b580-dabb4bb5b4eb	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-13 15:37:38.313+03	\N
34644d4c-005d-4f87-8de5-25ea9aadf489	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	BOOKING_CREATED	Booking	b9146650-2237-4534-b220-2279ee9547d3	{"flightNumber": "NV100", "bookingReference": "NVJAENFZ"}	\N	2026-10-13 15:56:42.754+03	b9146650-2237-4534-b220-2279ee9547d3
1bcbdb50-9b79-4f4a-b45d-22df1bca434a	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	SEAT_HELD	Booking	b9146650-2237-4534-b220-2279ee9547d3	{"holdCount": 1, "seatNumbers": ["5B"], "flightNumber": "NV100", "bookingReference": "NVJAENFZ"}	\N	2026-10-13 15:56:42.758+03	b9146650-2237-4534-b220-2279ee9547d3
8644a52f-a6af-4755-bfb4-221fb623aa5b	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	PAYMENT_INTENT_CREATED	Payment	632db962-8067-4ad9-8cd7-dc7e4e81b5e8	{"paymentId": "632db962-8067-4ad9-8cd7-dc7e4e81b5e8", "providerStatus": "requires_payment_method", "bookingReference": "NVJAENFZ", "providerReference": "pi_3UQ5G7RplmQkGUx50MYMuesA"}	\N	2026-10-13 15:56:45.541+03	b9146650-2237-4534-b220-2279ee9547d3
78f1c372-525c-451c-8ec7-9eb5c4b0e64f	\N	System	PAYMENT_SUCCEEDED	Payment	632db962-8067-4ad9-8cd7-dc7e4e81b5e8	{"via": "retrieve", "paymentId": "632db962-8067-4ad9-8cd7-dc7e4e81b5e8", "transitioned": true, "providerReference": "pi_3UQ5G7RplmQkGUx50MYMuesA"}	\N	2026-10-13 15:57:18.76+03	b9146650-2237-4534-b220-2279ee9547d3
23b33db1-3a98-4444-9f60-0c70b5262b3c	\N	System	BOOKING_CONFIRMED	Booking	b9146650-2237-4534-b220-2279ee9547d3	{"via": "retrieve", "paymentId": "632db962-8067-4ad9-8cd7-dc7e4e81b5e8", "bookingReference": "NVJAENFZ"}	\N	2026-10-13 15:57:18.763+03	b9146650-2237-4534-b220-2279ee9547d3
4a839294-ec30-47cc-90dc-d9e0057ebd84	\N	System	SEAT_HOLD_CONVERTED	Booking	b9146650-2237-4534-b220-2279ee9547d3	{"holdCount": 1, "seatNumbers": ["5B"], "bookingReference": "NVJAENFZ"}	\N	2026-10-13 15:57:18.765+03	b9146650-2237-4534-b220-2279ee9547d3
42acc166-9e5e-4ba8-b977-c33e8ffa74ef	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	CHECK_IN_COMPLETED	Booking	b9146650-2237-4534-b220-2279ee9547d3	{"checkInCount": 1, "flightNumber": "NV100", "bookingReference": "NVJAENFZ"}	\N	2026-10-13 15:57:49.87+03	b9146650-2237-4534-b220-2279ee9547d3
59036f19-11b7-415e-ae89-b9c793546d9e	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	07492bf3-86cb-4e0e-bda1-98a29452b43e	\N	\N	2026-10-13 15:58:10.726+03	\N
33e338c0-3db3-4343-aceb-a8c840279c55	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-13 15:58:32.175+03	\N
b0295f0b-4ee3-4250-9e95-21cdc18c5dc3	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	f463fcfd-a06f-441c-ba95-5ddb54fca08a	\N	\N	2026-10-13 16:00:32.084+03	\N
d83089e2-1cc5-462b-9730-e02e89fca175	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-13 16:00:38.534+03	\N
546ab732-46e8-408e-a247-f8d0294a37ab	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	c863caa2-e6fa-4f69-a685-d0616cd49627	\N	\N	2026-10-13 16:01:17.558+03	\N
4f5874d5-9760-4d59-a017-5bcb3b02e82c	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-13 16:01:23.622+03	\N
2d4a926a-2aad-4f73-8404-73986514c2f3	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	da314fa6-ff9d-4566-b28d-4a52fd3f623a	\N	\N	2026-10-13 16:01:32.624+03	\N
9b9591a7-3be6-4e48-b7b6-823fe3283f80	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-13 17:13:33.083+03	\N
7cb10ad0-d1b3-43e4-90d9-0c85bc228148	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	7e60fa77-c1d8-4204-b158-1c31dd1f6ad5	\N	\N	2026-10-13 17:13:45.679+03	\N
3210e3bc-87d2-4bd3-bc89-ba7cccfcc0ca	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-13 17:13:58.89+03	\N
ca579c79-f4a7-42df-9618-b057267cff38	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	7ecd2c5d-ff55-46d2-a11c-b4888b8bec69	\N	\N	2026-10-13 17:26:52.415+03	\N
d91bfba6-e925-41ed-bfd3-5409712cf124	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-13 17:26:59.354+03	\N
b63c8f1d-bef8-4527-bb58-ed02de6fd796	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	BOOKING_CREATED	Booking	81c4405c-835d-4005-bb06-38a7f7efb2a6	{"flightNumber": "NV103", "bookingReference": "NVZX3T5N"}	\N	2026-10-13 17:32:06.713+03	81c4405c-835d-4005-bb06-38a7f7efb2a6
230cf01b-6747-4a81-9f37-18aae07edad2	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	SEAT_HELD	Booking	81c4405c-835d-4005-bb06-38a7f7efb2a6	{"holdCount": 1, "seatNumbers": ["4E"], "flightNumber": "NV103", "bookingReference": "NVZX3T5N"}	\N	2026-10-13 17:32:06.717+03	81c4405c-835d-4005-bb06-38a7f7efb2a6
a1713a2f-2003-4ce1-aa1f-012ff4d388c1	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	PAYMENT_INTENT_CREATED	Payment	ffaf768b-76c3-4d9d-be60-d43513ce027c	{"paymentId": "ffaf768b-76c3-4d9d-be60-d43513ce027c", "providerStatus": "requires_payment_method", "bookingReference": "NVZX3T5N", "providerReference": "pi_3UQ6kQRplmQkGUx50iqh3kCY"}	\N	2026-10-13 17:32:11.103+03	81c4405c-835d-4005-bb06-38a7f7efb2a6
67e2f086-a9b0-4496-ab83-a0a7a5db5188	\N	System	PAYMENT_SUCCEEDED	Payment	ffaf768b-76c3-4d9d-be60-d43513ce027c	{"via": "retrieve", "paymentId": "ffaf768b-76c3-4d9d-be60-d43513ce027c", "transitioned": true, "providerReference": "pi_3UQ6kQRplmQkGUx50iqh3kCY"}	\N	2026-10-13 17:32:44.545+03	81c4405c-835d-4005-bb06-38a7f7efb2a6
c899b562-1ef7-448e-8ef9-dc911155ccc6	\N	System	BOOKING_CONFIRMED	Booking	81c4405c-835d-4005-bb06-38a7f7efb2a6	{"via": "retrieve", "paymentId": "ffaf768b-76c3-4d9d-be60-d43513ce027c", "bookingReference": "NVZX3T5N"}	\N	2026-10-13 17:32:44.547+03	81c4405c-835d-4005-bb06-38a7f7efb2a6
f6066ba5-a40e-4f92-96ea-ec7a6b09f4c5	\N	System	SEAT_HOLD_CONVERTED	Booking	81c4405c-835d-4005-bb06-38a7f7efb2a6	{"holdCount": 1, "seatNumbers": ["4E"], "bookingReference": "NVZX3T5N"}	\N	2026-10-13 17:32:44.549+03	81c4405c-835d-4005-bb06-38a7f7efb2a6
d785d0ea-6182-49e4-963a-d107edf27467	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	8f02dca5-df33-4769-a56c-0215c448d0e4	\N	\N	2026-10-13 18:49:42.312+03	\N
71cb59b7-02c7-406d-abf1-f707570527d2	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	USER_LOGGED_IN	User	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	::1	2026-10-13 18:49:49.194+03	\N
4d23eeec-e5c5-4ee8-bbe6-ca808c928a5e	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	User	LOGOUT	Session	da4b17da-124d-4115-b6b2-1674b3a371ac	\N	\N	2026-10-13 18:50:31.194+03	\N
6a11c140-95ee-4ecb-af4e-4752ec4f162b	c420004f-c75c-4c25-947e-d9d0e6c3aa44	User	USER_LOGGED_IN	User	c420004f-c75c-4c25-947e-d9d0e6c3aa44	\N	::1	2026-10-13 18:50:35.602+03	\N
96d1ec24-bc5c-42ca-8447-67fb8edd89f7	c420004f-c75c-4c25-947e-d9d0e6c3aa44	User	BOOKING_CREATED	Booking	3401d257-c7fd-4416-a482-9b5de1efaf34	{"flightNumber": "NV103", "bookingReference": "NVGVMH6F"}	\N	2026-10-13 19:17:12.963+03	3401d257-c7fd-4416-a482-9b5de1efaf34
1e4b8f05-6498-46b7-a623-b1a056e081b9	c420004f-c75c-4c25-947e-d9d0e6c3aa44	User	SEAT_HELD	Booking	3401d257-c7fd-4416-a482-9b5de1efaf34	{"holdCount": 1, "seatNumbers": ["4D"], "flightNumber": "NV103", "bookingReference": "NVGVMH6F"}	\N	2026-10-13 19:17:12.966+03	3401d257-c7fd-4416-a482-9b5de1efaf34
2a47f144-1f64-4883-a9b5-042ddc04c782	c420004f-c75c-4c25-947e-d9d0e6c3aa44	User	PAYMENT_INTENT_CREATED	Payment	87a38b88-cf77-491c-81bf-c12895e99361	{"paymentId": "87a38b88-cf77-491c-81bf-c12895e99361", "providerStatus": "requires_payment_method", "bookingReference": "NVGVMH6F", "providerReference": "pi_3UQ8O7RplmQkGUx51sSIqtyR"}	\N	2026-10-13 19:17:15.979+03	3401d257-c7fd-4416-a482-9b5de1efaf34
a53edc8c-d8fe-471f-9d03-c3a8cc63baf2	\N	System	PAYMENT_SUCCEEDED	Payment	87a38b88-cf77-491c-81bf-c12895e99361	{"via": "retrieve", "paymentId": "87a38b88-cf77-491c-81bf-c12895e99361", "transitioned": true, "providerReference": "pi_3UQ8O7RplmQkGUx51sSIqtyR"}	\N	2026-10-13 19:17:47.855+03	3401d257-c7fd-4416-a482-9b5de1efaf34
30cf8f5f-75ed-4a11-92c8-191717751211	\N	System	BOOKING_CONFIRMED	Booking	3401d257-c7fd-4416-a482-9b5de1efaf34	{"via": "retrieve", "paymentId": "87a38b88-cf77-491c-81bf-c12895e99361", "bookingReference": "NVGVMH6F"}	\N	2026-10-13 19:17:47.857+03	3401d257-c7fd-4416-a482-9b5de1efaf34
67598e95-2a9e-4571-baf5-1e067083ae64	\N	System	SEAT_HOLD_CONVERTED	Booking	3401d257-c7fd-4416-a482-9b5de1efaf34	{"holdCount": 1, "seatNumbers": ["4D"], "bookingReference": "NVGVMH6F"}	\N	2026-10-13 19:17:47.858+03	3401d257-c7fd-4416-a482-9b5de1efaf34
756956c2-f5b8-4d4f-99a1-9c579925588a	c420004f-c75c-4c25-947e-d9d0e6c3aa44	User	LOGOUT	Session	0fe136c8-9d3e-4e8a-a66b-5edcf51934a2	\N	\N	2026-10-13 19:18:19.347+03	\N
8c135865-7fdd-4181-aea2-bfb4bd0a9801	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	USER_LOGGED_IN	User	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	::1	2026-10-13 19:18:35.3+03	\N
cc746cf8-2252-4bee-a0f4-dc179dec4570	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Staff	REFUND_COMPLETED	Refund	a0d7f7eb-5042-41ce-8331-17d47f00205f	{"amount": 1309, "reason": "refuned accepted", "currency": "EUR", "refundId": "a0d7f7eb-5042-41ce-8331-17d47f00205f", "paymentId": "87a38b88-cf77-491c-81bf-c12895e99361", "bookingReference": "NVGVMH6F", "providerReference": "re_3UQ8O7RplmQkGUx5135Syzgr"}	\N	2026-10-13 19:20:05.239+03	3401d257-c7fd-4416-a482-9b5de1efaf34
8d648b53-4f1e-4959-afd7-0f41df6ff0f0	e01abc5f-5343-4078-a4e0-2fdec3ee013d	User	LOGOUT	Session	00124014-1211-4086-aa3e-28773f69839d	\N	\N	2026-10-13 19:20:21.322+03	\N
2f4cab2f-6c00-491d-9f30-99657b0e49c3	c420004f-c75c-4c25-947e-d9d0e6c3aa44	User	USER_LOGGED_IN	User	c420004f-c75c-4c25-947e-d9d0e6c3aa44	\N	::1	2026-10-13 19:20:34.243+03	\N
0f4ec38c-1a96-417e-8d63-64e0bc3da240	c420004f-c75c-4c25-947e-d9d0e6c3aa44	User	CHECK_IN_COMPLETED	Booking	3401d257-c7fd-4416-a482-9b5de1efaf34	{"checkInCount": 1, "flightNumber": "NV103", "bookingReference": "NVGVMH6F"}	\N	2026-10-13 19:23:34.429+03	3401d257-c7fd-4416-a482-9b5de1efaf34
\.


--
-- Data for Name: baggage; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.baggage (id, booking_passenger_id, type, weight_kg, pieces, tag_number, status) FROM stdin;
3e1e7bd4-ca0e-47f8-ae66-4ba3d770fdee	8e7638b6-ac51-49ac-b3d8-e17cf1a3136d	CHECKED	22	1	NV00000001	LOADED
7d77f508-a2d0-46a2-8438-d9974cde5a86	8e7638b6-ac51-49ac-b3d8-e17cf1a3136d	CHECKED	18	1	NV00000002	DELIVERED
\.


--
-- Data for Name: baggage_events; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.baggage_events (id, baggage_id, event_type, location, metadata, occurred_at) FROM stdin;
59553c36-08a5-4ac4-b66a-37f577b253ff	3e1e7bd4-ca0e-47f8-ae66-4ba3d770fdee	CHECKED_IN	FRA Terminal 1	\N	2026-10-08 09:41:09.702+03
9a029286-93ee-485c-a136-fba3dc54f9ad	3e1e7bd4-ca0e-47f8-ae66-4ba3d770fdee	LOADED	FRA Ramp B	\N	2026-10-08 11:41:09.702+03
44dd2ad6-f0aa-4530-9de0-2cc96320f96d	7d77f508-a2d0-46a2-8438-d9974cde5a86	CHECKED_IN	FRA Terminal 1	\N	2026-10-07 12:41:09.702+03
dae02d5a-ae86-4519-bd68-a2e776292167	7d77f508-a2d0-46a2-8438-d9974cde5a86	LOADED	FRA Ramp A	\N	2026-10-07 14:41:09.702+03
941ebf54-d71c-4516-962f-642d8d19ca21	7d77f508-a2d0-46a2-8438-d9974cde5a86	DELAYED	JFK Baggage Services	\N	2026-10-07 18:41:09.702+03
fd24024b-08a1-43bb-ac1b-a0da4f390c11	7d77f508-a2d0-46a2-8438-d9974cde5a86	DELIVERED	JFK	\N	2026-10-08 15:12:39.399+03
\.


--
-- Data for Name: boarding_passes; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.boarding_passes (id, check_in_id, boarding_group, seat_number, gate, qr_code, issued_at) FROM stdin;
3da8394e-df8f-4e17-99f5-6f8cd2874c73	9af3bcd9-fa70-4194-a8d4-fd718bc18434	A	3D	\N	\N	2026-10-12 12:29:55.976+03
c8081761-039a-4109-8841-3af1cee632db	3693ea96-d9a0-4c01-80aa-0df8199eb6dd	C	2B	\N	\N	2026-10-12 14:28:46.957+03
bcf27514-b3e1-4028-ba12-4b172e75b69b	eef79992-0181-403b-8bb0-a424c555d8d3	A	6D	\N	\N	2026-10-12 15:09:28.836+03
9d5c0a51-ad0c-4914-b28e-bc71b20cad78	8f290972-27d2-45aa-93ed-c3c6a39fffd3	A	5B	\N	\N	2026-10-13 15:57:49.858+03
7ebd5bb1-55e2-4353-9c8c-d77334059534	8003e70d-9d81-48d1-b58a-3efe0010da05	A	4D	\N	\N	2026-10-13 19:23:34.422+03
\.


--
-- Data for Name: booking_extras; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.booking_extras (id, booking_id, extra_service_id, quantity, price) FROM stdin;
\.


--
-- Data for Name: booking_passengers; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.booking_passengers (id, booking_id, passenger_id, passenger_type) FROM stdin;
8e7638b6-ac51-49ac-b3d8-e17cf1a3136d	b2252f0e-8138-4ce9-b74b-929cd818ee11	72f3e5e8-0716-4570-959a-80677272a607	ADULT
08234a44-cca8-43a2-8710-2e6422c357e5	90886c87-c794-4803-ab23-402563190062	af1ba579-8dcb-48c9-a6e5-60b922285582	ADULT
9ea7ce24-67a7-431f-aaf6-4041a306d7b3	ab28ceb3-4cc4-4fef-8046-422df882e775	6dac4637-8265-49fc-993d-57824c60d84c	ADULT
0e7125d4-f05c-43a2-9e8b-ae9557619e06	13c5bbe6-f2d3-4be3-9acb-8b20e896867b	3ac84585-768c-4d64-931c-35fb77a9af79	ADULT
ec3e3fd0-d35d-48d7-9911-56c8901a578b	8a4fb707-cd06-4b81-858f-68c678d43a8d	ef1a0ed7-8f37-4145-9182-1811437cf315	ADULT
a9e03541-82ff-43df-a79d-4d9d8cc9dcd1	31f0228f-002b-4a71-9335-e5845c66538b	30628ba1-8e57-4d12-a004-4fc55383e326	ADULT
b78d43a4-a0ec-4b6a-8e14-855a25424c29	e4efd9f8-c6c9-44a8-96b5-ca3e6cce8e45	ed325aea-e960-4360-b77b-d9eae6c633ba	ADULT
5d477bd2-7ad2-4d1e-b618-9a63829a2031	00598b8b-835f-442a-a2f2-ad6d0bf3417f	8429b625-9f5e-47d7-b263-6b01d171cc62	ADULT
1d96a0b1-e486-4b3a-8613-ec43bce2dfb3	aa78e754-4d26-4759-891f-81febda53c2c	484452ad-b788-43d4-b71a-ae76a5fb5c70	ADULT
ae8b11e2-990b-435f-b441-e8d4fc003954	b80a3617-7cb0-4566-90cc-441ef0c6ab77	935ff413-9828-4189-9917-c409a6e427e6	ADULT
3201a106-24b4-4707-91a0-90b70fb63c46	e0137147-5d75-4ece-a4a1-b445a857193e	21710dac-e8c0-4311-986f-461fcbf83010	ADULT
012491c3-e17c-4eef-87c8-b51f54c88963	2dd1ce15-a14f-46b5-b47f-a29f17fc4028	48a404f6-e24b-4716-bade-b4f77ac19950	ADULT
33119edd-1d6a-4ca4-ad11-9160f587199e	56a6a3e3-36d1-460a-bae7-1acaa3327684	1e5b2c6c-f1cd-4c64-b061-7d0d08fb71f9	ADULT
e5ea9b4a-3d90-4674-9335-f7b9b620e5d5	59a7ed52-c362-44f1-b545-292fee0bf836	17b97463-4394-4eb2-b16b-239ae01be365	ADULT
094ab168-5a0a-4470-87f5-6fd533984cbf	ed6701ed-813e-4027-a3e1-0a01d3d911e3	d6c4a946-d0eb-4c08-b069-71d68c8cdc4f	ADULT
760f4aec-538b-4592-83b6-87db3c34cac1	56a92bc1-1398-4fb3-911c-f60891b143a3	a55ad360-9716-4226-b02f-286695219280	ADULT
f608f00f-cf21-4b42-a633-5bfcce41766f	e6f4fba4-c2c1-41eb-ac31-0fd41cd99b5b	023ec908-1390-4e60-af05-05f5621ac6b6	ADULT
d7c430ab-47c2-49d4-b9bd-0b188b4354b4	b080bb80-af80-4f63-b70b-5963cea26f6c	7c1485b9-8196-4f1a-acc9-661830d11e88	ADULT
a201cee2-09f4-47bc-9366-70990edc560e	4226ef1a-2643-4ff4-9669-05fdbc7c3157	ca0cd470-5c56-43f3-b70e-d169d5dcb484	ADULT
54e5ba1e-c40d-48e3-9991-1ca6c891d0a8	8f0251b4-1af2-4397-a781-ac7f2b6ceedc	f2344ead-5969-4298-8ad4-38c04225a014	ADULT
c38195a6-5d85-4c41-be89-cdfa254f413a	ec52f2d5-f1cc-4707-8a00-32cc1b503a69	10b7b230-d58b-46fc-8dc7-8b22a8a570ff	ADULT
d6df26da-c493-4ced-9892-ffd423769e9f	4236a14f-fe34-413a-b3e8-9d855720b6bb	39e4bdd8-8c3f-4927-8970-d51f87763143	ADULT
6e1fce36-3596-4f0c-8d3c-8cbf081ad823	802d1dac-67ac-44d9-a153-a5b6036fc90f	bcf8d628-73a1-406c-918e-ba1704f95322	ADULT
05826e71-1121-46b0-9e67-72927ef76244	108319d0-5696-4498-9c66-d05e5b1b2f99	d021c19f-6b2f-4321-878b-28015725ae5e	ADULT
73f91ca6-b969-4e04-9f59-d75e5b3d8b44	6a18720e-6788-4b8f-b236-3cae380f8143	efe096a5-4c89-4f5b-b75f-a07c57777a3a	ADULT
8550a6d3-3ba7-4120-9ae9-6af5769cb4b5	1c01d63f-133c-4aa4-8644-83787c65601d	a7c0fc12-1456-41c2-82bd-1aa57e1a1982	ADULT
251c1385-33e6-41c2-931e-e74c8ee251cd	e27218a4-ec6a-4801-84f1-3207b73af8aa	397a5e8a-8fcf-423f-b194-3c2841f38062	ADULT
b8e877b0-3644-4393-822b-2a9186dcda18	b9146650-2237-4534-b220-2279ee9547d3	4d85e12b-e076-4b61-b1b3-f1a57bd429c3	ADULT
2934f427-2c01-4961-8204-6275a2321741	81c4405c-835d-4005-bb06-38a7f7efb2a6	7b4691a4-a547-4cf5-97ad-71e32c81fb4e	ADULT
c599272b-3607-4007-8654-cd4abdedc5fd	3401d257-c7fd-4416-a482-9b5de1efaf34	1b67c87a-3797-428d-bc29-791cba8b5d5c	ADULT
\.


--
-- Data for Name: booking_seats; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.booking_seats (id, booking_passenger_id, flight_segment_id, seat_id, seat_number) FROM stdin;
928a69c3-ee56-4c72-a59b-17ec66c451e9	8e7638b6-ac51-49ac-b3d8-e17cf1a3136d	bb820672-d1e7-4a2a-b58b-ebc848e82450	aafd8967-9995-4f8d-ba42-01914eb24a2c	10A
cd7a46c6-aa8c-4d57-9f8d-fd30d6999ed4	9ea7ce24-67a7-431f-aaf6-4041a306d7b3	411c4c28-a916-4318-b2f2-53ad0b581d0d	ca803440-a304-4be1-88be-5b5e909903b6	1A
5749355e-437e-47d0-94c4-fed74f0a0a73	ec3e3fd0-d35d-48d7-9911-56c8901a578b	eed0dd5f-c132-4263-954c-1e0f3a24e45d	63455012-09da-4c62-8fee-c83c16379ef2	1A
f13559bc-c50b-4bd3-8338-d46d55456335	a9e03541-82ff-43df-a79d-4d9d8cc9dcd1	b935cce1-6048-4561-832d-23385ded9e36	ca803440-a304-4be1-88be-5b5e909903b6	1A
4e927599-d3d0-4ed7-b2d5-effcc769cf5c	ae8b11e2-990b-435f-b441-e8d4fc003954	b0ad5f42-3bf5-45b5-9eff-89996d449318	01b6adaa-759c-4a11-85a3-7ecf91b5be67	31F
7332d55a-7d11-4778-b779-1333df4264fa	f608f00f-cf21-4b42-a633-5bfcce41766f	b0ad5f42-3bf5-45b5-9eff-89996d449318	82bd664c-105e-4118-923c-99c21a5e445c	7C
222840b0-ee55-4236-9c97-c9c76e4bfeca	d7c430ab-47c2-49d4-b9bd-0b188b4354b4	895f3cb8-38ea-43d1-8fe0-20f9eba03dba	44b53c2e-449e-459d-a91f-e217fda3c645	10D
38421f6e-df89-4868-be16-23ba9d483452	a201cee2-09f4-47bc-9366-70990edc560e	7743fc45-2695-4985-a951-9b54d3e19a08	923c1a78-eac6-4906-9535-27459d4d435a	5C
2626887f-3352-4827-9f50-1913f9284f2c	54e5ba1e-c40d-48e3-9991-1ca6c891d0a8	47647be5-d0bd-4b46-9d5a-fed519c38ebc	ca803440-a304-4be1-88be-5b5e909903b6	1A
660fb190-6aca-47c1-84aa-db33958c7a2f	c38195a6-5d85-4c41-be89-cdfa254f413a	87c5b569-a6d1-47e7-a42a-a369139dd590	3130b36e-3e19-4c57-8aaf-bb4d61cb08ce	7A
f31b2fda-c078-4eb8-a8ad-7c6f2f6713b6	d6df26da-c493-4ced-9892-ffd423769e9f	666411f4-eb6d-4a21-afad-463efa419a00	4f4a8f95-dcd4-47f2-b5be-671f6b947e89	4C
0f3278ff-faf7-4538-bd5c-4ac7ca455626	6e1fce36-3596-4f0c-8d3c-8cbf081ad823	bead4d27-ea05-4040-8150-e1b79831d626	929f23d9-19bf-442a-9af8-6daf0cd56941	4B
0c1eaa86-0aab-447f-bb33-a1442067324f	73f91ca6-b969-4e04-9f59-d75e5b3d8b44	90c4fce1-65c4-46f6-9597-d39bf1dba8d4	78cd5be8-c278-4035-b5f7-fa331fb1a4dc	3D
63cf32fd-4ad4-400e-9acc-a59cd0b16cf5	8550a6d3-3ba7-4120-9ae9-6af5769cb4b5	31720b0b-11e5-4fa3-a082-9cc3d89c06c6	05cb5511-816e-4f9d-8904-de85006dcb6a	2B
9187e51a-3c6c-4456-b191-a0db1947ef83	251c1385-33e6-41c2-931e-e74c8ee251cd	70134ac1-5de6-46b4-ba6c-b71e9fa03209	58f1a93f-5122-4102-ba32-8dd7ead6efdc	6D
b3561775-b337-4750-b7f8-79a29526bb9b	b8e877b0-3644-4393-822b-2a9186dcda18	091f3d5f-3486-4db0-a322-ecefd99f2d84	95e3f33e-fad2-4462-b700-0afa1634b578	5B
7479bfe3-c9b5-459a-9352-d98053c63f9b	2934f427-2c01-4961-8204-6275a2321741	b05cc1cc-14a6-4f50-9103-8347a700f737	ba202295-edeb-475e-a85a-378daa9f94df	4E
bdfdbe0d-de32-405e-a2bb-9f435511b1c3	c599272b-3607-4007-8654-cd4abdedc5fd	b05cc1cc-14a6-4f50-9103-8347a700f737	4051f4fc-4199-4257-aba9-79c8ed696ad8	4D
\.


--
-- Data for Name: bookings; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.bookings (id, booking_reference, user_id, status, total_amount, currency, booked_at, contact_email, contact_phone, fare_rules_snapshot, idempotency_key, idempotency_request_hash, updated_at, offer_id) FROM stdin;
b2252f0e-8138-4ce9-b74b-929cd818ee11	NVKLCSDW	34eedc56-29ef-4665-87fa-648c6a23dc72	CONFIRMED	127.00	EUR	2026-09-30 12:51:13.563+03	customer@example.com	\N	{"cabinClass": "ECONOMY", "perPassenger": {"total": 127, "basePrice": 106, "feeAmount": 4, "taxAmount": 17}, "refundPolicy": null, "passengerCount": 1}	\N	\N	2026-10-06 01:37:34.339412+03	\N
ab28ceb3-4cc4-4fef-8046-422df882e775	NVEVEPXM	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	CONFIRMED	127.00	EUR	2026-09-30 22:15:32.411+03	ciyohi2912@aminavin.com	\N	{"cabinClass": "ECONOMY", "perPassenger": {"total": 127, "basePrice": 106, "feeAmount": 4, "taxAmount": 17}, "refundPolicy": null, "passengerCount": 1}	\N	\N	2026-10-06 01:37:34.339412+03	\N
90886c87-c794-4803-ab23-402563190062	NVPEND01	34eedc56-29ef-4665-87fa-648c6a23dc72	CANCELLED	127.00	EUR	2026-09-30 12:51:13.588+03	customer@example.com	\N	{"cabinClass": "ECONOMY", "perPassenger": {"total": 127, "basePrice": 106, "feeAmount": 4, "taxAmount": 17}, "refundPolicy": null, "passengerCount": 1}	\N	\N	2026-10-06 01:37:34.339412+03	\N
13c5bbe6-f2d3-4be3-9acb-8b20e896867b	NVHHMPRK	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	CANCELLED	2780.00	EUR	2026-10-05 18:27:04.932+03	ciyohi2912@aminavin.com	\N	{"cabinClass": "FIRST", "perPassenger": {"total": 2780, "basePrice": 2316, "feeAmount": 93, "taxAmount": 371}, "refundPolicy": null, "passengerCount": 1}	\N	\N	2026-10-06 01:37:34.339412+03	\N
8a4fb707-cd06-4b81-858f-68c678d43a8d	NVD3Z53P	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	CONFIRMED	2780.00	EUR	2026-10-05 19:16:33.329+03	ciyohi2912@aminavin.com	\N	{"cabinClass": "FIRST", "perPassenger": {"total": 2780, "basePrice": 2316, "feeAmount": 93, "taxAmount": 371}, "refundPolicy": null, "passengerCount": 1}	\N	\N	2026-10-06 01:37:34.339412+03	\N
31f0228f-002b-4a71-9335-e5845c66538b	NVU3RJGD	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	CONFIRMED	127.00	EUR	2026-10-06 02:02:35.624+03	ciyohi2912@aminavin.com	\N	{"cabinClass": "ECONOMY", "perPassenger": {"total": 127, "basePrice": 106, "feeAmount": 4, "taxAmount": 17}, "refundPolicy": null, "passengerCount": 1}	fd8a1305-83a4-4273-bc98-27f2e578a715	808f5a63a4234b2565363ab0ef5f8f94598d82abd3970d86a17992cadd9137e6	2026-10-06 02:02:40.64+03	\N
b80a3617-7cb0-4566-90cc-441ef0c6ab77	NV77EVVY	34eedc56-29ef-4665-87fa-648c6a23dc72	CONFIRMED	346.00	EUR	2026-10-06 16:43:48.918+03	customer@example.com	\N	{"cabinClass": "ECONOMY", "perPassenger": {"total": 346, "basePrice": 288, "feeAmount": 12, "taxAmount": 46}, "refundPolicy": null, "passengerCount": 1}	26e57b71-d543-4b30-9eeb-8bb7c6602e20	731e368b1b7b747145688ed69a4fa2e89506808dca3e2d2316d1536762484ed4	2026-10-06 16:44:33.656+03	\N
e4efd9f8-c6c9-44a8-96b5-ca3e6cce8e45	NVCXQJF8	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	CANCELLED	408.00	EUR	2026-10-06 15:34:52.397+03	ciyohi2912@aminavin.com	\N	{"cabinClass": "ECONOMY", "perPassenger": {"total": 408, "basePrice": 340, "feeAmount": 14, "taxAmount": 54}, "refundPolicy": null, "passengerCount": 1}	1280a7ab-94ed-49cc-8238-cf4b3e262333	39c50cf2c7eaeba3e8bb31aa57594d9e22dc2472806e6320e6c6c66095901d5b	2026-10-06 15:50:00.014+03	\N
56a6a3e3-36d1-460a-bae7-1acaa3327684	NV5P3KUT	34eedc56-29ef-4665-87fa-648c6a23dc72	CANCELLED	346.00	EUR	2026-10-06 16:49:28.321+03	customer@example.com	\N	{"cabinClass": "ECONOMY", "perPassenger": {"total": 346, "basePrice": 288, "feeAmount": 12, "taxAmount": 46}, "refundPolicy": null, "passengerCount": 1}	3edbd488-af2a-4d10-a1cd-0dfb597868a7	1e37cb6f4eb49eaf5bafc8408db9c8e24265c346989ad0315973d19cdcb6744f	2026-10-06 17:05:00.011+03	\N
00598b8b-835f-442a-a2f2-ad6d0bf3417f	NV3T3GTC	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	CANCELLED	408.00	EUR	2026-10-06 15:58:38.326+03	ciyohi2912@aminavin.com	\N	{"cabinClass": "ECONOMY", "perPassenger": {"total": 408, "basePrice": 340, "feeAmount": 14, "taxAmount": 54}, "refundPolicy": null, "passengerCount": 1}	a10817b1-7270-45db-9100-a12bfbccc333	ee51cf0c8255e09b3bcb1bde5b76d3c0c1735e72315aa163eb56c1a23f1595e0	2026-10-06 16:14:00.038+03	\N
aa78e754-4d26-4759-891f-81febda53c2c	NVD7BMF2	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	CANCELLED	127.00	EUR	2026-10-06 16:31:32.541+03	ciyohi2912@aminavin.com	\N	{"cabinClass": "ECONOMY", "perPassenger": {"total": 127, "basePrice": 106, "feeAmount": 4, "taxAmount": 17}, "refundPolicy": null, "passengerCount": 1}	8c19b9bc-55cb-41bd-9595-2d69506831d6	a601a488d690c59c9295d7b70de01987c15b9c4b60e0a8410fbb3eca8de857b7	2026-10-06 16:47:00.009+03	\N
56a92bc1-1398-4fb3-911c-f60891b143a3	NVWEEHVW	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	CANCELLED	127.00	EUR	2026-10-06 17:58:11.337+03	ciyohi2912@aminavin.com	\N	{"cabinClass": "ECONOMY", "perPassenger": {"total": 127, "basePrice": 106, "feeAmount": 4, "taxAmount": 17}, "refundPolicy": null, "passengerCount": 1}	1d08f390-c39b-47f4-88ab-039f37a1e606	e7997199fefc78b85be51b1a7b49416fed8f7b66e1774d82465738d218073eaa	2026-10-06 18:01:05.171+03	\N
e0137147-5d75-4ece-a4a1-b445a857193e	NV7UHZRK	34eedc56-29ef-4665-87fa-648c6a23dc72	CANCELLED	346.00	EUR	2026-10-06 16:46:00.562+03	customer@example.com	\N	{"cabinClass": "ECONOMY", "perPassenger": {"total": 346, "basePrice": 288, "feeAmount": 12, "taxAmount": 46}, "refundPolicy": null, "passengerCount": 1}	bd2807a3-e3b8-4813-b29e-1232fe5688d5	c4317acd4c0c036ac8ce38ec796a6eb1e537f30542de6ecd2ada16724bf03144	2026-10-06 17:02:00.009+03	\N
2dd1ce15-a14f-46b5-b47f-a29f17fc4028	NV64Z7TU	34eedc56-29ef-4665-87fa-648c6a23dc72	CANCELLED	346.00	EUR	2026-10-06 16:47:00.173+03	customer@example.com	\N	{"cabinClass": "ECONOMY", "perPassenger": {"total": 346, "basePrice": 288, "feeAmount": 12, "taxAmount": 46}, "refundPolicy": null, "passengerCount": 1}	1bfef591-d952-4347-a405-91f345e8525d	1b1d62e0f30b721c81c657587a4d12fc8a197782a52dc25f3b834f6c18c40170	2026-10-06 17:03:00.021+03	\N
59a7ed52-c362-44f1-b545-292fee0bf836	NVZB8NEN	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	CANCELLED	1428.00	EUR	2026-10-06 17:32:56.845+03	ciyohi2912@aminavin.com	\N	{"cabinClass": "BUSINESS", "perPassenger": {"total": 1428, "basePrice": 1190, "feeAmount": 48, "taxAmount": 190}, "refundPolicy": null, "passengerCount": 1}	06ded8b9-936b-4279-8b4d-a93767df36dc	914fc63526f429ea086c32d45e1c7e27c24e59d1980f2cf996692b95ed01901d	2026-10-06 17:48:00.02+03	\N
ed6701ed-813e-4027-a3e1-0a01d3d911e3	NVHPT96J	34eedc56-29ef-4665-87fa-648c6a23dc72	CANCELLED	346.00	EUR	2026-10-06 17:54:57.806+03	customer@example.com	\N	{"cabinClass": "ECONOMY", "perPassenger": {"total": 346, "basePrice": 288, "feeAmount": 12, "taxAmount": 46}, "refundPolicy": null, "passengerCount": 1}	b48b31eb-9045-480e-b10b-edae7ce2c2e0	2976ebe6594a878ebbc835b1d838c02492009aced21c3a67569aacdeb6abef51	2026-10-06 18:10:00.012+03	\N
e6f4fba4-c2c1-41eb-ac31-0fd41cd99b5b	NVNY4KYL	34eedc56-29ef-4665-87fa-648c6a23dc72	CONFIRMED	346.00	EUR	2026-10-06 18:13:54.069+03	customer@example.com	\N	{"cabinClass": "ECONOMY", "perPassenger": {"total": 346, "basePrice": 288, "feeAmount": 12, "taxAmount": 46}, "refundPolicy": null, "passengerCount": 1}	38ff8851-89a2-41a0-a0fc-a9f232ebe1fb	ddd32f303d2e2eadf29ee59600f7729893fbba8e3a0bcbc4e0e30d27348de33a	2026-10-06 18:25:14.531+03	\N
b080bb80-af80-4f63-b70b-5963cea26f6c	NV8XH8LV	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	CONFIRMED	505.00	EUR	2026-10-06 18:30:04.338+03	ciyohi2912@aminavin.com	\N	{"cabinClass": "ECONOMY", "perPassenger": {"total": 505, "basePrice": 421, "feeAmount": 17, "taxAmount": 67}, "refundPolicy": null, "passengerCount": 1}	31395e5a-c179-4854-9a7c-c324ed2b9377	879b84aad2ad279f1b22ad04808f23d7c6c1478763c2da627fdf2fc45469bb21	2026-10-06 18:32:44.516+03	\N
4226ef1a-2643-4ff4-9669-05fdbc7c3157	NVU8XPPU	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	CONFIRMED	127.00	EUR	2026-10-06 23:42:18.977+03	ciyohi2912@aminavin.com	\N	{"cabinClass": "ECONOMY", "perPassenger": {"total": 127, "basePrice": 106, "feeAmount": 4, "taxAmount": 17}, "refundPolicy": null, "passengerCount": 1}	b75777f2-b215-4687-b0a9-7c100b12a351	fc7fde0655ae2f5b90535c189deac6f8e107569d9040a0e7a80582e9d1530741	2026-10-06 23:43:38.473+03	\N
8f0251b4-1af2-4397-a781-ac7f2b6ceedc	NVPTJ3KU	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	CONFIRMED	127.00	EUR	2026-10-07 12:28:45.778+03	ciyohi2912@aminavin.com	\N	{"cabinClass": "ECONOMY", "perPassenger": {"total": 127, "basePrice": 106, "feeAmount": 4, "taxAmount": 17}, "refundPolicy": null, "passengerCount": 1}	c76da74a-8795-4230-9637-b75ee980cfc7	3105bc938865fbde6b4015ef14524cdee8ffc07f36ca3bed801f18b42b488e01	2026-10-07 12:30:56.909+03	\N
3401d257-c7fd-4416-a482-9b5de1efaf34	NVGVMH6F	c420004f-c75c-4c25-947e-d9d0e6c3aa44	CHECKED_IN	1309.00	EUR	2026-10-13 19:17:12.93+03	vapajey727@aahzz.com	\N	{"offer": {"id": "d4b1991e-e820-4073-903e-6cd147c0104c", "title": "NovaAir Seasonal Fare", "currency": "EUR", "discountType": "PERCENT", "discountValue": 10, "discountAmountPerPassenger": 119}, "cabinClass": "BUSINESS", "perPassenger": {"total": 1309, "basePrice": 1190, "feeAmount": 48, "taxAmount": 190, "discountAmount": 119}, "refundPolicy": null, "passengerCount": 1}	8d7ad7b3-b441-44ce-8dbc-60727769392a	803805b638f1537f36ff8a7a8d3078c5249e957845235da5d40e1b2f430ad152	2026-10-13 19:23:34.426+03	d4b1991e-e820-4073-903e-6cd147c0104c
ec52f2d5-f1cc-4707-8a00-32cc1b503a69	NVJP656P	24e598b1-ee10-457d-83bc-122a7e1ba398	CONFIRMED	505.00	EUR	2026-10-07 15:11:05.132+03	mosin99141@aahzz.com	\N	{"cabinClass": "ECONOMY", "perPassenger": {"total": 505, "basePrice": 421, "feeAmount": 17, "taxAmount": 67}, "refundPolicy": null, "passengerCount": 1}	95b865b1-b562-4b98-b48d-813d4b5ff728	731309ff1b0a24a40cd7beca98204d38b4bf6f9ede3afce6754fe55acbf4b250	2026-10-07 15:12:48.246+03	\N
108319d0-5696-4498-9c66-d05e5b1b2f99	NVKM2XVU	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	CANCELLED	2780.00	EUR	2026-10-08 17:37:22.249+03	ciyohi2912@aminavin.com	\N	{"offer": null, "cabinClass": "FIRST", "perPassenger": {"total": 2780, "basePrice": 2316, "feeAmount": 93, "taxAmount": 371, "discountAmount": 0}, "refundPolicy": null, "passengerCount": 1}	0dc03c71-9b5f-48b0-a556-0039e9b06232	f6eb315ae0e64c768027d907eaf41e7157c6e11b62fc0e72999e1f21dcccb25c	2026-10-08 17:39:23.399+03	\N
4236a14f-fe34-413a-b3e8-9d855720b6bb	NVAFAY5F	24e598b1-ee10-457d-83bc-122a7e1ba398	CONFIRMED	127.00	EUR	2026-10-08 14:23:47.625+03	mosin99141@aahzz.com	\N	{"offer": null, "cabinClass": "ECONOMY", "perPassenger": {"total": 127, "basePrice": 106, "feeAmount": 4, "taxAmount": 17, "discountAmount": 0}, "refundPolicy": null, "passengerCount": 1}	db02916e-6c95-4bb2-9af7-989b66068f48	ec1d0ca57c87378c632d0cf6de749e8779f10e7f6595ec671776ae454ce1eba3	2026-10-08 14:28:41.568+03	\N
802d1dac-67ac-44d9-a153-a5b6036fc90f	NVX2C72K	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	CONFIRMED	1547.90	EUR	2026-10-08 14:55:42.352+03	ciyohi2912@aminavin.com	\N	{"offer": {"id": "c482d2cc-79fc-47f3-a47e-18c7d7a21481", "title": "NovaAir Business Saver", "currency": "EUR", "discountType": "PERCENT", "discountValue": 15, "discountAmountPerPassenger": 221.1}, "cabinClass": "BUSINESS", "perPassenger": {"total": 1547.9, "basePrice": 1474, "feeAmount": 59, "taxAmount": 236, "discountAmount": 221.1}, "refundPolicy": null, "passengerCount": 1}	3d71e706-07a0-4e8f-a120-4e684a2104de	b0766832ec5813725d48c7129b1f3199d7084b0fbe55e6b70a67fd8d111f1998	2026-10-08 14:56:31.409+03	c482d2cc-79fc-47f3-a47e-18c7d7a21481
6a18720e-6788-4b8f-b236-3cae380f8143	NVPA4RSL	24e598b1-ee10-457d-83bc-122a7e1ba398	CHECKED_IN	1547.90	EUR	2026-10-12 00:27:08.075+03	mosin99141@aahzz.com	\N	{"offer": {"id": "c482d2cc-79fc-47f3-a47e-18c7d7a21481", "title": "NovaAir Business Saver", "currency": "EUR", "discountType": "PERCENT", "discountValue": 15, "discountAmountPerPassenger": 221.1}, "cabinClass": "BUSINESS", "perPassenger": {"total": 1547.9, "basePrice": 1474, "feeAmount": 59, "taxAmount": 236, "discountAmount": 221.1}, "refundPolicy": null, "passengerCount": 1}	f42e402f-6032-4e5e-9b52-967eb318c6d9	ef188f618535ec68695a884cb5f12662a2ca956978bbc5121bcfc04a2ec779c8	2026-10-12 12:29:55.983+03	c482d2cc-79fc-47f3-a47e-18c7d7a21481
b9146650-2237-4534-b220-2279ee9547d3	NVJAENFZ	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	CHECKED_IN	1769.00	EUR	2026-10-13 15:56:42.717+03	ciyohi2912@aminavin.com	\N	{"offer": null, "cabinClass": "BUSINESS", "perPassenger": {"total": 1769, "basePrice": 1474, "feeAmount": 59, "taxAmount": 236, "discountAmount": 0}, "refundPolicy": null, "passengerCount": 1}	bbd334a5-e97d-421f-8312-456f78f307f9	df93cea69321edb2d887dbdf1dff0c4cc22f1a140ee3916e3ff3df6c3cf54fa2	2026-10-13 15:57:49.867+03	\N
1c01d63f-133c-4aa4-8644-83787c65601d	NV7W4WJL	24e598b1-ee10-457d-83bc-122a7e1ba398	CHECKED_IN	116.40	EUR	2026-10-12 11:59:31.49+03	mosin99141@aahzz.com	\N	{"offer": {"id": "d4b1991e-e820-4073-903e-6cd147c0104c", "title": "NovaAir Seasonal Fare", "currency": "EUR", "discountType": "PERCENT", "discountValue": 10, "discountAmountPerPassenger": 10.6}, "cabinClass": "ECONOMY", "perPassenger": {"total": 116.4, "basePrice": 106, "feeAmount": 4, "taxAmount": 17, "discountAmount": 10.6}, "refundPolicy": null, "passengerCount": 1}	00a0477e-7bd6-46ac-956a-d4eeb066b542	924245d66e1a14e2d1e18da44743a6ac6d53ce6435ef3bda243624fe38129178	2026-10-12 14:28:46.96+03	d4b1991e-e820-4073-903e-6cd147c0104c
e27218a4-ec6a-4801-84f1-3207b73af8aa	NVE4LUZL	c420004f-c75c-4c25-947e-d9d0e6c3aa44	CHECKED_IN	1428.00	EUR	2026-10-12 15:06:45.624+03	vapajey727@aahzz.com	\N	{"offer": null, "cabinClass": "BUSINESS", "perPassenger": {"total": 1428, "basePrice": 1190, "feeAmount": 48, "taxAmount": 190, "discountAmount": 0}, "refundPolicy": null, "passengerCount": 1}	c53830d7-e001-46ab-9fb8-ee56cb357ea1	03526b72932cf6b0c5791bccab09a3be71a597797cf178ed392950ac3021e870	2026-10-12 15:09:28.841+03	\N
81c4405c-835d-4005-bb06-38a7f7efb2a6	NVZX3T5N	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	CONFIRMED	1428.00	EUR	2026-10-13 17:32:06.686+03	ciyohi2912@aminavin.com	\N	{"offer": null, "cabinClass": "BUSINESS", "perPassenger": {"total": 1428, "basePrice": 1190, "feeAmount": 48, "taxAmount": 190, "discountAmount": 0}, "refundPolicy": null, "passengerCount": 1}	171cb9a4-8cac-4c15-a721-2270030809e2	d0fb95b405f271a961174349a019896a514259f06316bd55fb310043114aec3a	2026-10-13 17:32:44.529+03	\N
\.


--
-- Data for Name: cancellation_requests; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.cancellation_requests (id, booking_id, user_id, reason, status, requested_at, reviewed_at, reviewed_by, rejection_reason, refund_id, created_at, updated_at) FROM stdin;
0f462bf9-7e97-4404-99ab-a6acec077731	108319d0-5696-4498-9c66-d05e5b1b2f99	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	need cancel booking	APPROVED	2026-10-08 17:38:34.234+03	2026-10-08 17:39:23.397+03	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	\N	2026-10-08 17:38:34.234+03	2026-10-08 17:39:23.398+03
5c14b18b-aa03-4dad-a444-b0bc03cca2d4	802d1dac-67ac-44d9-a153-a5b6036fc90f	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	NVX2C72K	REJECTED	2026-10-08 17:41:26.542+03	2026-10-12 14:43:11.543+03	e01abc5f-5343-4078-a4e0-2fdec3ee013d	\N	\N	2026-10-08 17:41:26.542+03	2026-10-12 14:43:11.544+03
\.


--
-- Data for Name: check_ins; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.check_ins (id, booking_passenger_id, flight_segment_id, check_in_time, status) FROM stdin;
9af3bcd9-fa70-4194-a8d4-fd718bc18434	73f91ca6-b969-4e04-9f59-d75e5b3d8b44	90c4fce1-65c4-46f6-9597-d39bf1dba8d4	2026-10-12 12:29:55.975+03	COMPLETED
3693ea96-d9a0-4c01-80aa-0df8199eb6dd	8550a6d3-3ba7-4120-9ae9-6af5769cb4b5	31720b0b-11e5-4fa3-a082-9cc3d89c06c6	2026-10-12 14:28:46.62+03	COMPLETED
eef79992-0181-403b-8bb0-a424c555d8d3	251c1385-33e6-41c2-931e-e74c8ee251cd	70134ac1-5de6-46b4-ba6c-b71e9fa03209	2026-10-12 15:09:28.835+03	COMPLETED
8f290972-27d2-45aa-93ed-c3c6a39fffd3	b8e877b0-3644-4393-822b-2a9186dcda18	091f3d5f-3486-4db0-a322-ecefd99f2d84	2026-10-13 15:57:49.856+03	COMPLETED
8003e70d-9d81-48d1-b58a-3efe0010da05	c599272b-3607-4007-8654-cd4abdedc5fd	b05cc1cc-14a6-4f50-9103-8347a700f737	2026-10-13 19:23:34.421+03	COMPLETED
\.


--
-- Data for Name: email_verification_tokens; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.email_verification_tokens (id, user_id, token_hash, expires_at, used_at, created_at) FROM stdin;
7bf3eeef-5120-459c-bce9-dfad51fc12db	9fd0f96e-5cbb-4857-87f8-66c1cafb2ceb	b4fd3cee4c939e5eb3f84eda68e1c1c561b92a0463de218afee1f5c04485ef9b	2026-10-01 11:58:48.471+03	\N	2026-09-30 11:58:48.475+03
fe93be1b-cb91-40fa-9902-37fa3edecd1c	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	5692e808f250989ea93f61cc372f5fb66f485ac9538170247075149aacbac6f2	2026-10-01 12:18:58.569+03	2026-09-30 12:19:08.525+03	2026-09-30 12:18:58.57+03
5ef1e912-a1b7-48d9-b31f-7ccae1add17f	07f79e6f-4ec3-470b-9058-4e793dc97d7e	563c8002196628ea5a0d9fd26c50a7d5ca7ee9e79914878961037092e7f2a836	2026-10-07 16:42:17.691+03	\N	2026-10-06 16:42:17.693+03
22f8ce42-6390-4d2b-95c2-913b27cb589f	24e598b1-ee10-457d-83bc-122a7e1ba398	50c0f144071f40015ef41312d9e6f87fb52f75c7458a7cfb8e58b97837f288e2	2026-10-08 15:06:15.807+03	2026-10-07 15:06:46.337+03	2026-10-07 15:06:15.809+03
f4b775a7-abac-421b-bd0e-28bb04f2260a	c420004f-c75c-4c25-947e-d9d0e6c3aa44	d41a987f7a5fc2cd6c29e00842faebd848473c4297a3bff9dd46b1e70d022fc9	2026-10-09 15:02:25.778+03	2026-10-08 15:02:54.306+03	2026-10-08 15:02:25.779+03
\.


--
-- Data for Name: extra_services; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.extra_services (id, code, name, description, price, currency, status) FROM stdin;
\.


--
-- Data for Name: fares; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.fares (id, flight_id, cabin_class, base_price, tax_amount, fee_amount, currency, available_count, fare_rules) FROM stdin;
b615b11a-155b-4f7e-8a50-765298d0ac0a	ee75fc27-0fe9-4866-b8c2-a113e9428875	ECONOMY	421.00	67.00	17.00	EUR	283	\N
5a30c649-7927-4888-9514-0b3dc6b497ac	ee75fc27-0fe9-4866-b8c2-a113e9428875	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
da32fc2a-2425-49a6-be39-bd00c4f84c39	ee75fc27-0fe9-4866-b8c2-a113e9428875	FIRST	2316.00	371.00	93.00	EUR	12	\N
3e99e54f-5fb3-4351-b977-46512890bff8	e3b2fd0d-1d27-47a0-8c6c-84bc56d8dab7	ECONOMY	421.00	67.00	17.00	EUR	283	\N
fd2a219e-5226-4b98-a6f2-e4aa459a3d37	e3b2fd0d-1d27-47a0-8c6c-84bc56d8dab7	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
044ae486-0bdc-46e8-8dbc-deeeac2e5094	e3b2fd0d-1d27-47a0-8c6c-84bc56d8dab7	FIRST	2316.00	371.00	93.00	EUR	12	\N
c1f06170-827d-415a-a9a1-2030c4bb98fd	ee3f952d-59a9-4454-8abd-1c7dff1c7b85	ECONOMY	608.00	97.00	24.00	EUR	328	\N
1dbd7a43-e3ec-4b16-a106-c09baa0922b4	ee3f952d-59a9-4454-8abd-1c7dff1c7b85	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
03a21964-370d-41c6-8777-e138a9f18b9c	ee3f952d-59a9-4454-8abd-1c7dff1c7b85	FIRST	3344.00	535.00	134.00	EUR	12	\N
ecc6c6a1-1ee6-4480-846a-28164a9c81b3	c1329f00-2f2a-46d1-bd1a-c8d5775613e9	ECONOMY	608.00	97.00	24.00	EUR	328	\N
eb95c3c5-b323-4702-a3e2-96f799e7eb94	c1329f00-2f2a-46d1-bd1a-c8d5775613e9	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
d9d4e6de-4166-45db-ba65-855810a50740	c1329f00-2f2a-46d1-bd1a-c8d5775613e9	FIRST	3344.00	535.00	134.00	EUR	12	\N
620b8442-3607-4a6e-87c8-a755761a9259	ccfbb8fe-34d7-4f69-9d1e-ec1b432339d6	ECONOMY	421.00	67.00	17.00	EUR	283	\N
bfb0fa4d-83d4-4598-bf96-ceb4ee70f48e	ccfbb8fe-34d7-4f69-9d1e-ec1b432339d6	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
fa6c48d2-8d37-4e07-8ce5-00323485c369	ccfbb8fe-34d7-4f69-9d1e-ec1b432339d6	FIRST	2316.00	371.00	93.00	EUR	12	\N
74afb63c-e0b2-4bd8-912e-9f29b00e7725	d066bf33-61f1-4984-b79f-e6bbb06aa6c0	ECONOMY	421.00	67.00	17.00	EUR	283	\N
27b91645-e5ab-478b-bc78-489e61a8834c	d066bf33-61f1-4984-b79f-e6bbb06aa6c0	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
bda11870-5020-445f-8ff4-c6f8ee955524	d066bf33-61f1-4984-b79f-e6bbb06aa6c0	FIRST	2316.00	371.00	93.00	EUR	12	\N
ec509e02-98ae-4528-8b99-e2bb3212dfd0	7db80102-6eb4-4c62-9ec2-e214e513a2c0	ECONOMY	421.00	67.00	17.00	EUR	283	\N
1a8aeac6-da4d-4b60-8b77-9e38deb62c41	7db80102-6eb4-4c62-9ec2-e214e513a2c0	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
cc98ada2-6740-4242-b892-56560b1411a6	7db80102-6eb4-4c62-9ec2-e214e513a2c0	FIRST	2316.00	371.00	93.00	EUR	12	\N
e1498fae-f2f9-490f-b16b-40833b44976f	66916b93-2a6f-4123-bc5c-32fa5a054c44	ECONOMY	421.00	67.00	17.00	EUR	283	\N
251cb818-d230-41f0-a6cc-ec100ba9429c	66916b93-2a6f-4123-bc5c-32fa5a054c44	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
d30e020b-d942-4310-b20a-15c503db870e	66916b93-2a6f-4123-bc5c-32fa5a054c44	FIRST	2316.00	371.00	93.00	EUR	12	\N
8bdfc0ea-f506-41c2-9058-cd95d6b5c210	fba2abab-cd29-463f-88b4-33219d16b4ac	ECONOMY	608.00	97.00	24.00	EUR	328	\N
ef8c4a5c-e5e7-4f65-ad58-1d1cc605a528	fba2abab-cd29-463f-88b4-33219d16b4ac	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
2b3ff176-ea6c-4a62-bf25-52e4bfee0d68	2aac8ac5-0e0a-4678-b368-fba482d2acf0	ECONOMY	608.00	97.00	24.00	EUR	328	\N
fdd3dc42-1d5d-47a1-81b1-045db2e659e8	2aac8ac5-0e0a-4678-b368-fba482d2acf0	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
b77b24f7-ba20-4cd2-a4ed-7ee1597b489c	2aac8ac5-0e0a-4678-b368-fba482d2acf0	FIRST	3344.00	535.00	134.00	EUR	12	\N
2991b081-012a-4eb5-8d1c-aeec1163ed11	13163a5d-b5e7-44be-96c3-a303384d3eb6	ECONOMY	608.00	97.00	24.00	EUR	328	\N
6c1a9bc6-136b-4657-9245-12c84ac9e6e0	13163a5d-b5e7-44be-96c3-a303384d3eb6	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
2d06243a-50d1-4401-9174-c60cf4397938	13163a5d-b5e7-44be-96c3-a303384d3eb6	FIRST	3344.00	535.00	134.00	EUR	12	\N
e49e5e38-18fe-492a-ba5f-528f117fe530	d4ba287e-52d4-41ab-814f-bf3efbd8a296	ECONOMY	608.00	97.00	24.00	EUR	328	\N
0cba8ad1-616d-4abe-951a-5098b9e9460a	d4ba287e-52d4-41ab-814f-bf3efbd8a296	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
dbd80c18-9ed0-4f07-be98-97c2e8c2dc7d	d4ba287e-52d4-41ab-814f-bf3efbd8a296	FIRST	3344.00	535.00	134.00	EUR	12	\N
9a865612-cdc2-4372-87c6-805ee94b8295	bcb6315b-e699-4081-8ef1-539fa17a4921	ECONOMY	608.00	97.00	24.00	EUR	328	\N
0e65897d-5e23-4a0f-9f9b-b31b2528e008	bcb6315b-e699-4081-8ef1-539fa17a4921	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
047fb9b6-f0d9-4ade-9c4e-31bfedc2d5f5	bcb6315b-e699-4081-8ef1-539fa17a4921	FIRST	3344.00	535.00	134.00	EUR	12	\N
b449d21e-71f2-4a5a-bb87-8f48ce9a0ef3	3cad428a-af0b-4547-a07f-0ce75b549c88	ECONOMY	608.00	97.00	24.00	EUR	328	\N
1fc8c0ed-95f7-40cb-bc58-aac51fd8db38	3cad428a-af0b-4547-a07f-0ce75b549c88	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
2c97ca49-263c-4270-9f4c-35df98a5485d	4a891611-df63-4adf-b7af-ac9fd06ad0f8	ECONOMY	608.00	97.00	24.00	EUR	328	\N
f9a82ea3-3b93-40fd-9c94-3be88de85c76	a0ba518c-d3aa-479a-b5b4-3a24e782fe08	ECONOMY	608.00	97.00	24.00	EUR	328	\N
13bfb9a1-ceb1-46ae-8883-08ee0ddef26f	a0ba518c-d3aa-479a-b5b4-3a24e782fe08	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
98ebb568-0849-4668-ac77-763558f1f130	a0ba518c-d3aa-479a-b5b4-3a24e782fe08	FIRST	3344.00	535.00	134.00	EUR	12	\N
a6b44bf5-2ce6-4737-8e91-f96039d42e19	d7c230b2-2747-4ca8-bd2f-9b808897b7e6	ECONOMY	608.00	97.00	24.00	EUR	328	\N
e0066da2-d212-4b56-898e-74f5627a3dd1	d7c230b2-2747-4ca8-bd2f-9b808897b7e6	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
433a68c0-436c-41ef-b7e9-512641fcd01d	d7c230b2-2747-4ca8-bd2f-9b808897b7e6	FIRST	3344.00	535.00	134.00	EUR	12	\N
83125bb4-a3f0-40f9-9c43-96fd61387f6b	f416f337-a4a4-49c5-bc93-cbe2d68607ed	ECONOMY	608.00	97.00	24.00	EUR	328	\N
f4b71c05-94b5-4cfb-b2b4-9df034ee18fc	f416f337-a4a4-49c5-bc93-cbe2d68607ed	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
8b436493-036a-4753-b4f4-199b0434036d	f416f337-a4a4-49c5-bc93-cbe2d68607ed	FIRST	3344.00	535.00	134.00	EUR	12	\N
4cec5451-9777-4da0-a04d-5e4f18d05708	4a891611-df63-4adf-b7af-ac9fd06ad0f8	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
889dc17d-3da8-4e8c-8edd-63ee43943e4d	4a891611-df63-4adf-b7af-ac9fd06ad0f8	FIRST	3344.00	535.00	134.00	EUR	12	\N
09124ad3-500f-401d-9927-4e776fe5512c	7e2e126f-3a7f-4175-920d-88206e151eb4	ECONOMY	608.00	97.00	24.00	EUR	328	\N
8529db81-cda1-4b5b-807b-c151cb3a988a	7e2e126f-3a7f-4175-920d-88206e151eb4	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
afe220f1-a519-403c-a095-d55b9b75b026	7e2e126f-3a7f-4175-920d-88206e151eb4	FIRST	3344.00	535.00	134.00	EUR	12	\N
e05d1853-b5b7-4016-892c-5a516b07a272	455173a4-d421-4164-9e77-48d0b9798870	ECONOMY	421.00	67.00	17.00	EUR	283	\N
b28e4b0e-8e07-4ab2-9f4d-5eae9fdb3a46	455173a4-d421-4164-9e77-48d0b9798870	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
2167c4af-39b9-4c2a-b9d3-650f55b4f981	a9e32a56-4d3c-415f-b617-f7b8fc453829	ECONOMY	421.00	67.00	17.00	EUR	283	\N
34e25260-f3c9-4392-abf2-f1c103f1ebcf	a9e32a56-4d3c-415f-b617-f7b8fc453829	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
b4ce6936-77d5-4349-8df4-080acf962738	a9e32a56-4d3c-415f-b617-f7b8fc453829	FIRST	2316.00	371.00	93.00	EUR	12	\N
7f28f6b2-6b97-4015-9791-7af32f82ed46	6324b5b2-2c7b-4949-bb01-76fc48c99363	ECONOMY	421.00	67.00	17.00	EUR	283	\N
478a56ac-7f38-43a5-ae71-11848aa304ab	6324b5b2-2c7b-4949-bb01-76fc48c99363	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
ca3fb842-8d00-4ea9-a3ef-bc0a342a0fbf	6324b5b2-2c7b-4949-bb01-76fc48c99363	FIRST	2316.00	371.00	93.00	EUR	12	\N
6520ab8f-a451-4c5c-a27b-7b1e93fe24bf	5c179b11-0992-4bed-a56f-d89da20452d6	ECONOMY	421.00	67.00	17.00	EUR	283	\N
e35ca8d7-7bc6-460c-a15e-d2ea421ec157	5c179b11-0992-4bed-a56f-d89da20452d6	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
240e3a16-d1be-487a-91fe-4e1ec0959738	5c179b11-0992-4bed-a56f-d89da20452d6	FIRST	2316.00	371.00	93.00	EUR	12	\N
dd3eca7e-0453-43e1-91b0-8f4e5a9be4a1	a1214ae0-f4de-4f20-b273-edadb5e08248	ECONOMY	421.00	67.00	17.00	EUR	283	\N
276ec808-e512-45a9-96f1-1a429d7cc849	a1214ae0-f4de-4f20-b273-edadb5e08248	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
eebdb792-ac2b-4d91-8e0b-1031008f6605	a1214ae0-f4de-4f20-b273-edadb5e08248	FIRST	2316.00	371.00	93.00	EUR	12	\N
6c232ccc-7bc1-400a-910e-3700cc862c1a	2580c8ab-904b-45b7-a934-28126b1be077	ECONOMY	421.00	67.00	17.00	EUR	283	\N
c14687c8-2e96-4d2c-904d-8d02e2be52ce	2580c8ab-904b-45b7-a934-28126b1be077	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
6e615224-fa85-4735-bdb4-54f8209f461e	2580c8ab-904b-45b7-a934-28126b1be077	FIRST	2316.00	371.00	93.00	EUR	12	\N
0e1a54f6-777f-46ba-b377-c3607df6d3d9	fba2abab-cd29-463f-88b4-33219d16b4ac	FIRST	3344.00	535.00	134.00	EUR	12	\N
12e6b9e2-6f4b-4976-af19-de0acec650bb	a7be747a-5f79-4888-969d-5d65f512cd2d	ECONOMY	421.00	67.00	17.00	EUR	283	\N
7aed64d3-57f3-4fa5-94b3-e2035e68995e	a7be747a-5f79-4888-969d-5d65f512cd2d	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
a78414e9-14fa-46cb-9be8-c5da926c7266	8e60a38f-c109-4bcc-9dfa-a45d6716bd4e	ECONOMY	666.00	107.00	27.00	EUR	328	\N
572fe1ef-4db4-483b-b9bd-9c934dbb67d3	8e60a38f-c109-4bcc-9dfa-a45d6716bd4e	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
8f31f5de-3482-4171-b6ef-1096b52a120c	8e60a38f-c109-4bcc-9dfa-a45d6716bd4e	FIRST	3663.00	586.00	147.00	EUR	12	\N
70b3bedd-28ad-4e80-a4e6-a889f14d11f2	fcf53ea0-9c6a-4648-8f83-eab616479fa5	ECONOMY	666.00	107.00	27.00	EUR	328	\N
6716aae5-e264-43ea-a913-ee11a02b4995	fcf53ea0-9c6a-4648-8f83-eab616479fa5	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
754b90b1-c9f6-4ddc-8a62-b564980193d9	fcf53ea0-9c6a-4648-8f83-eab616479fa5	FIRST	3663.00	586.00	147.00	EUR	12	\N
ab3980a5-9aec-4559-9abd-c1e1171ae223	4f876bb2-295b-4b7e-867f-7c4eaa7f53f3	ECONOMY	340.00	54.00	14.00	EUR	184	\N
a2f00433-1f6b-44ec-a41e-245b9d62fbcb	4f876bb2-295b-4b7e-867f-7c4eaa7f53f3	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
27e6c7da-8e08-4e6d-93b6-7f7cc959675b	fb1b0edd-9f4c-429a-a397-c3c5e1ac9ea5	ECONOMY	340.00	54.00	14.00	EUR	184	\N
7f5d17c5-fcb5-4d64-afdc-774f433040c2	fb1b0edd-9f4c-429a-a397-c3c5e1ac9ea5	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
d9a8654d-9426-400d-8a5e-01628427bc01	596afd03-ff24-4a78-961c-06655a623edd	ECONOMY	106.00	17.00	4.00	EUR	180	\N
ae2702e7-af0a-4b56-9082-ff8de9478cf4	f7445f66-313e-403d-b995-0db964ed0a71	ECONOMY	106.00	17.00	4.00	EUR	180	\N
1a1ac260-4717-4aef-a7b2-ff0710730f03	9b08128a-aafa-4512-a78e-216e7130104b	ECONOMY	666.00	107.00	27.00	EUR	328	\N
e01b8c60-24d6-4b73-a4f0-6bb5efb0873a	9b08128a-aafa-4512-a78e-216e7130104b	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
5f3eb43f-317f-4933-b8b9-c948df1b77a5	9b08128a-aafa-4512-a78e-216e7130104b	FIRST	3663.00	586.00	147.00	EUR	12	\N
e3392eb5-da11-40d4-928a-4e143e6a8823	a911737a-5506-477a-9ba2-0118fe2ebe0d	ECONOMY	666.00	107.00	27.00	EUR	328	\N
28f1378d-d981-46a6-81bf-7f0995ced2ee	a911737a-5506-477a-9ba2-0118fe2ebe0d	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
d980cfb6-418e-41bf-8ee6-7f2dfd99f451	a911737a-5506-477a-9ba2-0118fe2ebe0d	FIRST	3663.00	586.00	147.00	EUR	12	\N
be10184a-46a8-482b-876d-aa61c4f33412	a8286216-e58e-471e-8449-c59d4602da39	ECONOMY	666.00	107.00	27.00	EUR	328	\N
dd207227-87ae-4262-be16-10d4203c33eb	a8286216-e58e-471e-8449-c59d4602da39	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
d8ae295c-e981-48f2-b238-d674204237d7	a8286216-e58e-471e-8449-c59d4602da39	FIRST	3663.00	586.00	147.00	EUR	12	\N
a3b171d3-7319-4b7b-8265-e59ab8e4704b	38ea5f48-c27d-4d8b-91a1-dd4b4c8d6bb4	ECONOMY	666.00	107.00	27.00	EUR	328	\N
91fc8908-7031-4052-84ce-78ad5ee7156c	38ea5f48-c27d-4d8b-91a1-dd4b4c8d6bb4	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
bff608cb-43da-4650-9670-22b618976084	38ea5f48-c27d-4d8b-91a1-dd4b4c8d6bb4	FIRST	3663.00	586.00	147.00	EUR	12	\N
1ee76d84-dbe8-4267-856d-443ca0d67a02	89004b5a-80da-479f-b0fa-ea022d37fdae	ECONOMY	666.00	107.00	27.00	EUR	328	\N
c5455acd-3364-4b53-8aed-f59043ee3631	89004b5a-80da-479f-b0fa-ea022d37fdae	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
a65ae85f-a323-4dd5-8892-fb1e674bef13	aa134a72-6856-401e-8bdb-ee6c0ca1be45	ECONOMY	340.00	54.00	14.00	EUR	184	\N
593620ce-bc85-4a3c-ab5f-73d3066b0a74	aa134a72-6856-401e-8bdb-ee6c0ca1be45	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
8c9f4e9d-ee15-4c33-94d3-df476433c680	46e9b691-8fce-4ac0-8352-47590c2eee8a	ECONOMY	340.00	54.00	14.00	EUR	184	\N
d5ccb310-848b-4a9f-adbe-510d261408ac	46e9b691-8fce-4ac0-8352-47590c2eee8a	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
1be70777-b9c9-4029-8220-edd92fceef09	ef128ad4-7eef-41f4-bcee-c0d9cbcaa3ba	ECONOMY	340.00	54.00	14.00	EUR	184	\N
d47ae3bd-332f-4937-b10e-d7ef6c3ce4f8	ef128ad4-7eef-41f4-bcee-c0d9cbcaa3ba	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
ed825ca4-1fd2-4a47-96c9-037f2d4d0781	1b4ef376-54cb-4b6b-900c-877ec40b0eec	ECONOMY	340.00	54.00	14.00	EUR	184	\N
3e464116-d969-4fdb-9fdb-38b162dc2677	1b4ef376-54cb-4b6b-900c-877ec40b0eec	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
4ef01226-b5fa-4846-af8b-7661dfb4838a	478b8417-f3ff-436b-8f9d-938ddddb830c	ECONOMY	340.00	54.00	14.00	EUR	184	\N
80125a5d-230f-44cc-bd87-4157f553c89f	478b8417-f3ff-436b-8f9d-938ddddb830c	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
e9bb1be3-1ef2-4002-aeb3-e8c45d06b605	c0eca707-f474-464e-addb-35685d7b525a	ECONOMY	666.00	107.00	27.00	EUR	328	\N
29b1758f-19b6-4184-b953-c97de0ee3e00	c0eca707-f474-464e-addb-35685d7b525a	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
efd97a9d-9759-496a-a912-e8621c3d38a9	c0eca707-f474-464e-addb-35685d7b525a	FIRST	3663.00	586.00	147.00	EUR	12	\N
573b205f-abf8-47d4-b68e-a28260337e47	47458bad-87f0-4db3-a156-cec07d4436a9	ECONOMY	666.00	107.00	27.00	EUR	328	\N
fdc9c82b-9aa1-4c6e-a25c-8a78aa5b9190	47458bad-87f0-4db3-a156-cec07d4436a9	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
ff080e29-eb90-4038-9034-a4163650ce55	47458bad-87f0-4db3-a156-cec07d4436a9	FIRST	3663.00	586.00	147.00	EUR	12	\N
c47fb14a-5c58-4650-9748-2bdba76d3f5b	afdec5ce-7410-4537-bb35-5f13c07e2545	ECONOMY	340.00	54.00	14.00	EUR	184	\N
10030760-c53e-4693-8e36-a02930bda2dd	afdec5ce-7410-4537-bb35-5f13c07e2545	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
a860f94a-b684-4c1f-a613-4c7c029d1ac7	24f2f45f-d2dd-4d21-8243-8e42213fbe9c	ECONOMY	340.00	54.00	14.00	EUR	184	\N
189af91d-6534-4f33-92a0-fa404b852a11	3b136e93-2343-4c5c-a3d4-b1743210aab6	ECONOMY	340.00	54.00	14.00	EUR	184	\N
efd19ee8-e0f6-4254-bd90-575f27d0e8cd	3b136e93-2343-4c5c-a3d4-b1743210aab6	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
af555231-26a0-4b19-b3f8-04bd18ed6f65	ecefd8b8-335a-4887-bf2e-1ced6ce4eaaf	ECONOMY	340.00	54.00	14.00	EUR	184	\N
3fc16262-13c0-4d24-83a0-9206f45f2002	ecefd8b8-335a-4887-bf2e-1ced6ce4eaaf	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
ef7210d1-d46a-4a6f-998c-906e99f468b6	7c0cbd46-0e48-4426-94cb-337e9ef31135	ECONOMY	340.00	54.00	14.00	EUR	184	\N
c6550a98-085e-4fd6-98e1-09ba5640b868	7c0cbd46-0e48-4426-94cb-337e9ef31135	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
0f321c3f-c659-4f69-aed1-4b57ee1b0fb7	24f2f45f-d2dd-4d21-8243-8e42213fbe9c	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
24effbf0-4be6-404d-9b6f-9c1786a2a394	d94d7a82-45b0-495e-ab90-df511b64e086	ECONOMY	340.00	54.00	14.00	EUR	184	\N
b12b5caf-c951-466e-9565-0375fa28c44f	d94d7a82-45b0-495e-ab90-df511b64e086	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
64f597ec-7f36-4aac-8247-3cd3a27ea8f1	a87f517a-c050-4df5-a963-a0ba8aa6dad3	ECONOMY	666.00	107.00	27.00	EUR	328	\N
12bd1987-ca9a-4b93-a616-dba69b53a4bf	a87f517a-c050-4df5-a963-a0ba8aa6dad3	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
3c57c10a-4755-44ce-a860-8ab4876330ba	a87f517a-c050-4df5-a963-a0ba8aa6dad3	FIRST	3663.00	586.00	147.00	EUR	12	\N
6cb77876-08f3-4cac-be93-39214c9f3843	23e82c36-9cae-47d3-826b-08af261000ff	ECONOMY	666.00	107.00	27.00	EUR	328	\N
2fb4fc5c-5bb2-4d06-8a09-1d48a373ab25	23e82c36-9cae-47d3-826b-08af261000ff	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
d232a4a6-7449-408d-b252-f5856c1d71cd	23e82c36-9cae-47d3-826b-08af261000ff	FIRST	3663.00	586.00	147.00	EUR	12	\N
238fa557-5262-47b5-ae98-e74a8b8e7446	9eda0fa6-5756-4284-85f1-0bb71bfa3ef1	ECONOMY	666.00	107.00	27.00	EUR	328	\N
005c57b7-cad7-4d74-8436-64996e326c15	9eda0fa6-5756-4284-85f1-0bb71bfa3ef1	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
f9ac339d-1e26-45da-86bd-ff8234344b54	9eda0fa6-5756-4284-85f1-0bb71bfa3ef1	FIRST	3663.00	586.00	147.00	EUR	12	\N
8f2a42e6-9465-4f93-ac32-3b765f957fdb	986c960b-1415-45a7-af4d-c7f6407fafb1	ECONOMY	340.00	54.00	14.00	EUR	184	\N
44c799c3-5d42-4c85-b7e8-96b4e44f9a7d	986c960b-1415-45a7-af4d-c7f6407fafb1	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
acc44b29-c263-492f-b842-7216bc499899	3062e613-4bfc-4bbd-8699-a5cfb7ac9c88	ECONOMY	106.00	17.00	4.00	EUR	180	\N
68bae22f-4406-46fb-904d-e08bc0dfefe8	41bbd0d7-4490-42a2-aa71-e08349ac2844	ECONOMY	106.00	17.00	4.00	EUR	180	\N
ac6c54d9-131d-45da-9497-5fef00bd71c8	1db470f2-964f-4bb5-99f7-d61b297536f1	ECONOMY	106.00	17.00	4.00	EUR	180	\N
6500996d-a4d4-4b5c-8260-cd438210e65f	451cafd1-5933-406a-8efd-b8f118826b4a	ECONOMY	106.00	17.00	4.00	EUR	180	\N
30f55d10-a3ac-47f0-867f-5937511fc22b	80a805e2-9561-4f94-8c8d-12efb5ae4558	ECONOMY	106.00	17.00	4.00	EUR	180	\N
869454bb-740a-4959-90ec-b5527218f942	5923cdf1-f997-46ad-956e-bebfc9785630	ECONOMY	106.00	17.00	4.00	EUR	180	\N
a0908a68-2bd0-4549-b4c4-bc7ee3164637	fd3b4250-b81b-4a88-9085-da83cee0fec0	ECONOMY	666.00	107.00	27.00	EUR	328	\N
68f96a9d-7cbc-4cd4-ba38-e0ed1fdbba92	85603a6d-cf8a-4459-b1a9-a11d643a24cb	ECONOMY	99.00	16.00	4.00	EUR	184	\N
8ab6dba6-f89a-41a0-b224-22dbe41acd4c	85603a6d-cf8a-4459-b1a9-a11d643a24cb	BUSINESS	347.00	56.00	14.00	EUR	36	\N
2668dae0-d0ae-4a4a-81cb-d853503dca59	ac2a881a-7b5b-4521-8233-50e1769e0478	ECONOMY	99.00	16.00	4.00	EUR	184	\N
fde4751a-9efb-4439-b1bb-993a1ad88327	ac2a881a-7b5b-4521-8233-50e1769e0478	BUSINESS	347.00	56.00	14.00	EUR	36	\N
a88a7775-f963-47de-9c0a-36e4c02bc000	52757b35-8ad2-43f6-b2c8-1b239861a458	ECONOMY	72.00	12.00	3.00	EUR	180	\N
ef3fee09-6b07-4a3a-9367-d27e42dbeeb2	84e34adf-7d23-45a7-a646-27dbf50ef755	ECONOMY	72.00	12.00	3.00	EUR	180	\N
e435a57c-2a32-461b-a7da-7ebe1e6e3e13	dc7a6c7f-81bb-4f56-90c7-521d68d8ecd3	ECONOMY	288.00	46.00	12.00	EUR	184	\N
3469d0aa-e2e4-4daf-a250-403565bee32c	dc7a6c7f-81bb-4f56-90c7-521d68d8ecd3	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
f1b44bb4-d697-4c2e-8d09-9ddd8a2bd2e1	84b8b8c1-2463-46fc-bcfb-7f74ddb663d9	ECONOMY	288.00	46.00	12.00	EUR	184	\N
b21dd110-ec76-4753-b2d1-292e435fdc9c	84b8b8c1-2463-46fc-bcfb-7f74ddb663d9	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
85bf88c6-47d9-4e48-be68-fe7b0f9b03a0	7327c98b-30ec-4141-9a86-66031f942e53	ECONOMY	421.00	67.00	17.00	EUR	283	\N
69c4b22e-34d6-4b87-8aea-916cea276bdb	7327c98b-30ec-4141-9a86-66031f942e53	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
3c893d14-aab2-470d-becb-e2165df1fb68	7327c98b-30ec-4141-9a86-66031f942e53	FIRST	2316.00	371.00	93.00	EUR	12	\N
53227d32-1b03-4036-8b16-5913909a45ab	5f8cc8fa-8dbe-42ee-8720-44f882f6b562	ECONOMY	99.00	16.00	4.00	EUR	184	\N
99a4423a-407e-4981-9bfc-dae5cf8dc238	ed47d012-c65c-4b49-b5b6-22526ef1f458	ECONOMY	99.00	16.00	4.00	EUR	184	\N
49be91e5-8a09-4b70-928b-3c0c1f8ad779	38d543ed-4594-4165-97b9-dfa2485cdc82	ECONOMY	99.00	16.00	4.00	EUR	184	\N
482376d6-27a0-4ee2-9652-8c0fef929ab4	6b7eef8f-09c8-455f-aa9e-17e726c5f3ee	ECONOMY	99.00	16.00	4.00	EUR	184	\N
ba29fff5-eef8-4ed4-a5d4-acc49a1887b5	cb653773-70ed-4c3d-b849-a6b088b005c1	ECONOMY	99.00	16.00	4.00	EUR	184	\N
94a7a0bb-a5a6-4a38-a092-88f1366404c3	b07f558d-5181-4b79-a149-fedad1d5d936	ECONOMY	99.00	16.00	4.00	EUR	184	\N
7c4fba5b-5d54-43de-88e9-bcc46609b983	6c8d996f-ef77-43a7-ad99-9e39e2026eea	ECONOMY	99.00	16.00	4.00	EUR	184	\N
4b83349d-6aaa-443d-9d28-28777ecec54a	6c8d996f-ef77-43a7-ad99-9e39e2026eea	BUSINESS	347.00	56.00	14.00	EUR	36	\N
614ed262-fbae-42c0-922b-7d5bc4266003	2ed8024c-2fbb-4021-859b-56e09fa589c7	ECONOMY	99.00	16.00	4.00	EUR	184	\N
58f922af-41bc-47f9-a6b4-9071c3709469	2ed8024c-2fbb-4021-859b-56e09fa589c7	BUSINESS	347.00	56.00	14.00	EUR	36	\N
7116c858-16be-4dcb-8f67-58258d4c7e60	37c6416b-5c07-4bdd-bd32-9e7e427988b7	ECONOMY	99.00	16.00	4.00	EUR	184	\N
af29cd39-5e05-4093-846a-1a4ded9ddeec	37c6416b-5c07-4bdd-bd32-9e7e427988b7	BUSINESS	347.00	56.00	14.00	EUR	36	\N
44d75713-f420-4c0b-bec2-35c75babf15b	880bec33-5d55-4055-b9d6-e0f74ea5836b	ECONOMY	99.00	16.00	4.00	EUR	184	\N
4008321e-749d-45c3-873e-ccb0fdb1db96	880bec33-5d55-4055-b9d6-e0f74ea5836b	BUSINESS	347.00	56.00	14.00	EUR	36	\N
fb741e59-4665-4274-9843-622f66005210	f6693ce8-ba8a-4a86-8cf4-fc0a63a544b5	ECONOMY	72.00	12.00	3.00	EUR	180	\N
0afb64fe-cd67-466d-8bf7-9cc1907bebc4	04e3ccc0-8942-469f-991c-52142e688144	ECONOMY	72.00	12.00	3.00	EUR	180	\N
b0ff4a49-a1a4-489b-921f-9668d84ab7d5	275c6977-7df8-43f0-818a-5d160070f44a	ECONOMY	72.00	12.00	3.00	EUR	180	\N
6c2fd11a-55a8-49f5-9835-f0424042a6b9	dbdc7e75-32a3-4304-ba4d-81802a32cb1a	ECONOMY	72.00	12.00	3.00	EUR	180	\N
7a199db2-0dbd-4e62-8825-7f03b1c206eb	b9b562ca-3a8d-48b0-9276-49d0a7b197d7	ECONOMY	72.00	12.00	3.00	EUR	180	\N
7dfb637d-eb2b-4070-8dfd-08aca64f7a36	38a44152-e0a9-4191-85c2-c5e8a4559d93	ECONOMY	72.00	12.00	3.00	EUR	180	\N
aada40ca-0fc2-4290-afc8-ed7ce2582eaf	3c8ac90d-2a87-4efe-845d-3439b4b1d989	ECONOMY	288.00	46.00	12.00	EUR	184	\N
10d37778-c13d-4b4b-9ce4-d6ae4d612082	5f0a79cf-a5bc-438f-8693-f5664350f994	ECONOMY	288.00	46.00	12.00	EUR	184	\N
a2bcabfc-c7e9-4be3-88bf-1ea775a3a2be	5f0a79cf-a5bc-438f-8693-f5664350f994	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
30685d10-69d3-4235-90b4-32e2795f88e3	193d11df-1877-47c1-b43d-00eecbacaa98	ECONOMY	288.00	46.00	12.00	EUR	184	\N
a7481eac-d94d-4704-a639-8c6cad03b603	193d11df-1877-47c1-b43d-00eecbacaa98	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
3bd92179-8deb-4f31-9049-71aa34e669e1	3066bd0f-54d9-4821-a0f0-2cf2c454a74d	ECONOMY	72.00	12.00	3.00	EUR	180	\N
a4388171-77aa-450e-848c-c10c6ef33fae	5f6d728c-0119-454a-b4ed-0607897b20ca	ECONOMY	72.00	12.00	3.00	EUR	180	\N
1be54c5b-0b0d-4c1d-969d-c9c7b31dc4a3	e00b6cce-6792-4811-857b-e8ce1a2483c9	ECONOMY	72.00	12.00	3.00	EUR	180	\N
75ad37d3-75ba-446f-84ed-bb13cbad6435	617b993b-a4a0-47cf-95e6-ab42cf765d1f	ECONOMY	72.00	12.00	3.00	EUR	180	\N
78f6f4cc-dff0-41db-ba43-3b2494a0ed71	3ec99e22-08e7-4135-8fc9-150c74a718d7	ECONOMY	72.00	12.00	3.00	EUR	180	\N
c0d00cb5-fa26-454e-bd72-10653d386d6c	a778a83a-5948-464e-be88-20b7fee45e6e	ECONOMY	72.00	12.00	3.00	EUR	180	\N
5dc0d2e4-9beb-4cfc-b0ac-eca0cc381544	bedce820-8ab7-4b86-b5e5-737a2289084e	ECONOMY	288.00	46.00	12.00	EUR	184	\N
0e8590a9-1d72-41cb-8aad-f359edb58b24	bedce820-8ab7-4b86-b5e5-737a2289084e	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
6045a8f5-d671-48cc-8382-98f5c12df2e1	2b521517-8cb6-48d9-947b-e075d8d9aafa	ECONOMY	288.00	46.00	12.00	EUR	184	\N
b78dab3c-4b2c-40fc-bc9b-99193d1f126c	2b521517-8cb6-48d9-947b-e075d8d9aafa	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
09d8e1a1-35ed-435d-972a-dbe3f2704f88	dde1a113-f013-4b02-ab9b-8bd880904d2e	ECONOMY	288.00	46.00	12.00	EUR	184	\N
1de92b16-356f-4f5d-9817-7e511c47844f	dde1a113-f013-4b02-ab9b-8bd880904d2e	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
375ff549-e3a9-4e3a-b709-f3d9458021d2	b5230204-3701-4994-8988-37f9258e531e	ECONOMY	288.00	46.00	12.00	EUR	184	\N
ff7e37a6-3ed1-4e76-b512-4d9a33954ac3	b5230204-3701-4994-8988-37f9258e531e	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
e0c2c87e-f59f-44d8-ab7d-2c878283aa56	742a0fab-8895-4302-a99c-b97f0d53f940	ECONOMY	288.00	46.00	12.00	EUR	184	\N
4556ee9b-1a31-4660-9a21-c49384f12b45	742a0fab-8895-4302-a99c-b97f0d53f940	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
62e8e96b-6027-4997-a5b2-538621421529	9a09923e-b787-4599-bc22-a3b2740ec0b4	ECONOMY	288.00	46.00	12.00	EUR	184	\N
404efafd-318b-4544-ae55-b887374af234	46ab9a4c-e3f0-4f26-ba31-8021de028202	ECONOMY	288.00	46.00	12.00	EUR	184	\N
648466d7-776a-4db5-a20d-fd2007907890	46ab9a4c-e3f0-4f26-ba31-8021de028202	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
662d8c86-bcfd-4325-b52e-c0aa3b35f8fc	c9da46d2-0f00-452b-8356-87af4b6b3bee	ECONOMY	288.00	46.00	12.00	EUR	184	\N
c4e59140-1d56-48d2-9f3a-9fd0ee9a8efc	c9da46d2-0f00-452b-8356-87af4b6b3bee	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
7988f83e-495c-4e48-bd6b-04b19601b724	b094f7e8-2942-40b7-809f-81a9fc806ad8	ECONOMY	288.00	46.00	12.00	EUR	184	\N
793b987a-8699-4801-a2a3-091d12f5129c	b094f7e8-2942-40b7-809f-81a9fc806ad8	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
846151fb-6210-4487-a9ec-7b4a3e17779b	f59de4d7-d5a9-45fe-9030-ec29c3e1a558	ECONOMY	106.00	17.00	4.00	EUR	180	\N
64cae0f2-b72a-485e-8e49-cc314f84b6ee	d438d5c7-a166-4698-9a4d-bb14573bf829	ECONOMY	106.00	17.00	4.00	EUR	180	\N
8a6caa05-a2f1-493e-a683-2477cbe22636	9eee9d47-9c4f-4de2-b623-046b0215b36c	ECONOMY	106.00	17.00	4.00	EUR	180	\N
40ae9798-ee33-418f-9c76-c3eb0a0e4eea	50f82444-a5e3-4da2-8ed1-8317ab291d7b	ECONOMY	106.00	17.00	4.00	EUR	180	\N
baf2f489-a813-42b3-ab4b-6d38ace2c6e2	85b083d5-e320-4d45-9cfd-d16083731b77	ECONOMY	106.00	17.00	4.00	EUR	180	\N
56b782f3-751b-4c31-ab2b-f915d4885c3d	ce55a67a-5535-4dd7-8416-1dc08a13aacf	ECONOMY	99.00	16.00	4.00	EUR	184	\N
dab11550-700b-475e-b44f-c565aa9e4ab1	b71f1061-56b0-4cf1-8e38-9f0a1f54565a	ECONOMY	99.00	16.00	4.00	EUR	184	\N
0af96e58-faae-4e16-b909-5a6d5351fd09	b71f1061-56b0-4cf1-8e38-9f0a1f54565a	BUSINESS	347.00	56.00	14.00	EUR	36	\N
0b7e7e9a-f629-470d-8792-0e3b77d245e9	5f8cc8fa-8dbe-42ee-8720-44f882f6b562	BUSINESS	347.00	56.00	14.00	EUR	36	\N
1dd591e4-e3bd-49e8-9fbf-65cc8b4aec86	ed47d012-c65c-4b49-b5b6-22526ef1f458	BUSINESS	347.00	56.00	14.00	EUR	36	\N
23f672da-e0fe-4ab4-8f1d-4678f90c4760	38d543ed-4594-4165-97b9-dfa2485cdc82	BUSINESS	347.00	56.00	14.00	EUR	36	\N
e1e6ad09-4852-4f3d-851a-9ed7ab36312f	6b7eef8f-09c8-455f-aa9e-17e726c5f3ee	BUSINESS	347.00	56.00	14.00	EUR	36	\N
8414f05e-c662-4854-b58b-cba26156bcb5	d8fffdfb-e549-44d1-841f-75754ed106d1	ECONOMY	421.00	67.00	17.00	EUR	283	\N
c28266dc-5d1d-4bae-b520-0a1897fb95b8	d8fffdfb-e549-44d1-841f-75754ed106d1	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
1f30a408-746c-4274-969a-5a3c80389f4f	3c8ac90d-2a87-4efe-845d-3439b4b1d989	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
6b87f171-dab9-4287-9bec-a80f0ae740a3	bd2a26fb-ee11-4641-addc-bc1d6266d5eb	ECONOMY	666.00	107.00	27.00	EUR	328	\N
583105f6-e091-4d05-b032-9a866d92c632	bd2a26fb-ee11-4641-addc-bc1d6266d5eb	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
cdf37e3b-5ce7-4451-8748-d236d38a6057	bd2a26fb-ee11-4641-addc-bc1d6266d5eb	FIRST	3663.00	586.00	147.00	EUR	12	\N
99c2fade-8f46-4b12-853d-def3ced705b1	039f9c11-057f-4060-a978-452f685c2db8	ECONOMY	106.00	17.00	4.00	EUR	180	\N
b09fb03c-6469-4a9b-83fb-43f8a6feb13e	12875a5c-930c-44ac-8236-6f2c55275bc6	ECONOMY	106.00	17.00	4.00	EUR	180	\N
184f2938-03de-4790-9e88-02796d58b08a	e1b36b0e-9c60-4dbf-8601-25af9e7170c9	ECONOMY	421.00	67.00	17.00	EUR	283	\N
0bbec3fe-1718-44a5-8caa-d06dc0d46f94	e1b36b0e-9c60-4dbf-8601-25af9e7170c9	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
d15ff58c-9e68-4fea-ba07-5bbd60844321	e1b36b0e-9c60-4dbf-8601-25af9e7170c9	FIRST	2316.00	371.00	93.00	EUR	12	\N
fcb9d978-1075-4596-85af-e2aa66976e69	cefe8319-bb62-408c-92e6-7a5dd6834d3d	ECONOMY	421.00	67.00	17.00	EUR	283	\N
871e39b7-57b0-404f-97e9-89b56ebecc8a	9225f50f-5fd8-49d0-9c37-39ecc46314a8	ECONOMY	421.00	67.00	17.00	EUR	283	\N
ff1b92c3-5541-4b3f-bf6e-1c16c74f6a3f	9225f50f-5fd8-49d0-9c37-39ecc46314a8	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
825abacc-28a8-445f-aa7b-d5b72a90ad38	9225f50f-5fd8-49d0-9c37-39ecc46314a8	FIRST	2316.00	371.00	93.00	EUR	12	\N
362182d3-da1d-4c31-b113-a58fc28d01c7	9f101579-1c7e-4095-ab28-0a1df8a72f7a	ECONOMY	106.00	17.00	4.00	EUR	180	\N
e3cf252a-38e8-452c-90e2-0eb30d590f34	0857ec3e-f50f-42c0-bbb0-0a165581739e	ECONOMY	106.00	17.00	4.00	EUR	180	\N
99d7d33a-8e60-4c66-9885-0aca0cd37ba6	48032a86-2862-41bc-ad5e-30831dd17bf6	ECONOMY	106.00	17.00	4.00	EUR	180	\N
e875bb85-b1ac-4ed8-9cc4-cbe7e1775244	a96d8963-6988-4ecf-a6b3-2e77ff6429e3	ECONOMY	106.00	17.00	4.00	EUR	180	\N
85957490-a41e-4609-9cb7-16d688ad0af7	455173a4-d421-4164-9e77-48d0b9798870	FIRST	2316.00	371.00	93.00	EUR	12	\N
a451dd5f-0cd3-463e-8b06-2d3740b57b1d	818d5802-4003-416a-833f-0b1fc8360033	ECONOMY	421.00	67.00	17.00	EUR	283	\N
3993ec73-41c4-4183-bbb6-9dbe247766fc	acb97cc1-5d6f-4bda-956a-7c4af03cd247	ECONOMY	666.00	107.00	27.00	EUR	328	\N
32671e4a-9791-464a-b648-d5fe528696bd	acb97cc1-5d6f-4bda-956a-7c4af03cd247	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
adb8b9b6-681b-410d-b05c-55c0bbc51af0	acb97cc1-5d6f-4bda-956a-7c4af03cd247	FIRST	3663.00	586.00	147.00	EUR	12	\N
15f48fca-2797-40e6-a58d-f9361abd64ae	628d3c70-12d6-4a42-8167-c8a8dda8a209	ECONOMY	666.00	107.00	27.00	EUR	328	\N
1d5cbb67-7168-4e2b-ae97-a78b551980b3	628d3c70-12d6-4a42-8167-c8a8dda8a209	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
6da33ac3-65b1-47ad-a8c1-b49b90818cc1	818d5802-4003-416a-833f-0b1fc8360033	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
943bf6e4-3f69-4697-b442-dcc4d533a57f	048d508a-0875-4efb-93b1-32afa408760d	ECONOMY	421.00	67.00	17.00	EUR	283	\N
6c4e9115-93df-4c70-9a15-87035d2e9128	048d508a-0875-4efb-93b1-32afa408760d	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
7ad3575c-4585-4147-a6a2-950b5ef16007	048d508a-0875-4efb-93b1-32afa408760d	FIRST	2316.00	371.00	93.00	EUR	12	\N
35e032f0-43f3-4468-840a-d60e58c06a15	5d0e714f-c26b-4cfe-8f85-df83bd89ec6e	ECONOMY	608.00	97.00	24.00	EUR	328	\N
17813c0d-600d-48fe-bc54-aada9454cd9d	5d0e714f-c26b-4cfe-8f85-df83bd89ec6e	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
71f3a5fe-8a92-42eb-8291-11da249fedd7	5d0e714f-c26b-4cfe-8f85-df83bd89ec6e	FIRST	3344.00	535.00	134.00	EUR	12	\N
60161c23-2962-4591-bfee-250c82690836	59ec564b-c994-4382-8569-34cc1dc7ed88	ECONOMY	608.00	97.00	24.00	EUR	328	\N
b25a0662-0900-4ae1-bb45-51a9248e9adb	59ec564b-c994-4382-8569-34cc1dc7ed88	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
54a6890f-a4ef-463c-9ba2-be392257d4d7	f94aa451-e474-4ac9-bd65-a5c1ca68f4d1	ECONOMY	106.00	17.00	4.00	EUR	180	\N
ed2f4dcd-96df-4b81-9232-f6d5f78e48ab	f66c2140-bb85-47ab-802d-d05ef034ad4e	ECONOMY	106.00	17.00	4.00	EUR	180	\N
e0cf0c7b-7962-4b34-ac12-3506ea9c6be2	fc9dc5a1-a972-4be8-9473-9442d5faabd4	ECONOMY	106.00	17.00	4.00	EUR	180	\N
e60bdbed-5a6c-41c5-ba36-232185780b55	dcb45d77-34e1-4333-a9ac-db8f763ea434	ECONOMY	106.00	17.00	4.00	EUR	180	\N
04d05537-cfab-490c-a1e7-f2b266a9fb1f	59ec564b-c994-4382-8569-34cc1dc7ed88	FIRST	3344.00	535.00	134.00	EUR	12	\N
9354b6e4-22f2-4595-b3e2-d60fe643b281	d9ad0cca-3b0a-4dec-9141-d62a339d214e	ECONOMY	608.00	97.00	24.00	EUR	328	\N
1eab83be-684c-4f3e-a034-2c3174e85c63	d9ad0cca-3b0a-4dec-9141-d62a339d214e	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
00127753-f1b3-4328-9136-23f6a91aa28c	d9ad0cca-3b0a-4dec-9141-d62a339d214e	FIRST	3344.00	535.00	134.00	EUR	12	\N
b80e7a4d-87c7-4030-9a0b-9dfc18979311	e69877e4-cbd5-414c-b067-8a08f1987e7a	ECONOMY	666.00	107.00	27.00	EUR	328	\N
1d77ec82-35ef-48fd-977f-d76a69686007	e69877e4-cbd5-414c-b067-8a08f1987e7a	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
f0f86321-fbbd-444a-ae7f-565512ef955f	e69877e4-cbd5-414c-b067-8a08f1987e7a	FIRST	3663.00	586.00	147.00	EUR	12	\N
eb08a4d0-ae87-4680-88ef-ab7e77e63178	292c1a2f-9a6c-4c99-87b5-936e51c81add	ECONOMY	666.00	107.00	27.00	EUR	328	\N
d36ed097-a0e2-4bae-99b2-920f87e931c6	292c1a2f-9a6c-4c99-87b5-936e51c81add	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
ceed272c-ec4f-4817-afe7-c9813955c8a0	292c1a2f-9a6c-4c99-87b5-936e51c81add	FIRST	3663.00	586.00	147.00	EUR	12	\N
3c680a83-9d05-4487-be71-d6ed8c92f21f	b3e5c692-9dcc-4238-be2f-b7076e16debb	ECONOMY	340.00	54.00	14.00	EUR	184	\N
3712ed43-dd8f-43ba-aef8-4906ad0434e3	b3e5c692-9dcc-4238-be2f-b7076e16debb	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
d9eec64c-129a-4b28-a879-1cb45ed9c563	5f6a60b0-ebc2-409a-bf59-5308a8fcb2d6	ECONOMY	340.00	54.00	14.00	EUR	184	\N
16a3545f-f979-43ea-8493-29dae306e6ee	3cad428a-af0b-4547-a07f-0ce75b549c88	FIRST	3344.00	535.00	134.00	EUR	12	\N
35e921ad-9589-4708-9165-a8a423688871	5f6a60b0-ebc2-409a-bf59-5308a8fcb2d6	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
7605454b-1801-4cab-af1c-5451372fe0ac	ebe67ce0-34d6-4512-83a8-8db97b70a8c5	ECONOMY	106.00	17.00	4.00	EUR	180	\N
7e2c90b1-1df6-4e08-a23a-fc1e0edb116f	066de7a9-a60e-4dca-9c19-f0811538fa94	ECONOMY	106.00	17.00	4.00	EUR	180	\N
0e1f9133-4a13-48e4-930c-258bdee585e4	6baee32a-3901-479e-8158-ec4c71b49462	ECONOMY	106.00	17.00	4.00	EUR	180	\N
c97ca0d2-0ed6-45cc-b5bb-dcdea865a821	70733ce0-3cf8-407b-8dc5-7e4555d1b9a6	ECONOMY	421.00	67.00	17.00	EUR	283	\N
fcf9e279-3c32-4162-9588-7431a32fcd7f	70733ce0-3cf8-407b-8dc5-7e4555d1b9a6	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
d351fc51-fbb4-4dd6-9f33-354b5713e7df	70733ce0-3cf8-407b-8dc5-7e4555d1b9a6	FIRST	2316.00	371.00	93.00	EUR	12	\N
8ad65b72-9c94-4147-9f77-e30510f7cbc6	b042ffc9-d17f-4e06-a2d0-78d94d500176	ECONOMY	421.00	67.00	17.00	EUR	283	\N
577876de-2bc3-44f6-aece-f7c18e0876f5	b042ffc9-d17f-4e06-a2d0-78d94d500176	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
09b8c74f-be76-494f-8ee6-ab244dc019f1	89004b5a-80da-479f-b0fa-ea022d37fdae	FIRST	3663.00	586.00	147.00	EUR	12	\N
e5f68f25-634b-4192-9b90-83fc0ea8a0f0	b042ffc9-d17f-4e06-a2d0-78d94d500176	FIRST	2316.00	371.00	93.00	EUR	12	\N
42bb18d9-5c5f-4e4e-8c0a-101d53ef2f42	d5a91a42-60ae-4e11-a963-daa17eef9a16	ECONOMY	421.00	67.00	17.00	EUR	283	\N
76c14125-db3f-4181-8f3a-8f92442611a4	d5a91a42-60ae-4e11-a963-daa17eef9a16	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
1985b2eb-4a63-46fa-a29d-f822012e57e4	d5a91a42-60ae-4e11-a963-daa17eef9a16	FIRST	2316.00	371.00	93.00	EUR	12	\N
d418ef84-6e7c-43bb-b371-51c5a2701937	7c1ad5a4-aed7-4e87-9b04-e9e50196b4d3	ECONOMY	666.00	107.00	27.00	EUR	328	\N
49ca5d20-0e97-473f-9217-5d2859a4f720	7c1ad5a4-aed7-4e87-9b04-e9e50196b4d3	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
8bdac3d2-5cc4-471d-b9c0-d0a458c4e674	7c1ad5a4-aed7-4e87-9b04-e9e50196b4d3	FIRST	3663.00	586.00	147.00	EUR	12	\N
e964d555-0d0d-410e-ab58-5a543e1a8948	2f3bdbdd-e312-4bd8-b26f-c34b2d6107f7	ECONOMY	666.00	107.00	27.00	EUR	328	\N
b87393c1-d678-4973-bca3-bd16fc07a279	2f3bdbdd-e312-4bd8-b26f-c34b2d6107f7	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
8c0f4374-181f-4c2e-bf27-18174e80a0db	2f3bdbdd-e312-4bd8-b26f-c34b2d6107f7	FIRST	3663.00	586.00	147.00	EUR	12	\N
16b006ac-f20e-4459-b145-7b54f58b8fb2	c61c4cc9-6fa8-4968-a9fb-e3169218a985	ECONOMY	666.00	107.00	27.00	EUR	328	\N
a7d56ca7-47e7-40c4-b2ca-0a083b7e1291	c61c4cc9-6fa8-4968-a9fb-e3169218a985	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
4933f7ff-cd0f-4442-be86-d52ee24f4a35	c61c4cc9-6fa8-4968-a9fb-e3169218a985	FIRST	3663.00	586.00	147.00	EUR	12	\N
1038334d-b8f1-478c-ad8b-c35d8558abc4	a84c61bf-1520-4598-96f0-61295f59ca03	ECONOMY	421.00	67.00	17.00	EUR	283	\N
a9518840-19fd-4a0f-b138-725008605f8b	a84c61bf-1520-4598-96f0-61295f59ca03	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
55f4e4e3-ce58-4b23-ad44-ec262bd6cc93	b07f558d-5181-4b79-a149-fedad1d5d936	BUSINESS	347.00	56.00	14.00	EUR	36	\N
badf7eda-5c62-47d9-b70d-f6573b626667	9a09923e-b787-4599-bc22-a3b2740ec0b4	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
d07bdc5c-4e1c-4ad6-891b-bd217a98f441	d8fffdfb-e549-44d1-841f-75754ed106d1	FIRST	2316.00	371.00	93.00	EUR	12	\N
f68907b1-f6cc-4050-bfc0-a6ca3e71fc54	cefe8319-bb62-408c-92e6-7a5dd6834d3d	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
7270bd7b-6351-48e0-a0de-fb122b31fc49	cefe8319-bb62-408c-92e6-7a5dd6834d3d	FIRST	2316.00	371.00	93.00	EUR	12	\N
3e7c82dd-c5a2-4b0d-964d-3452cf89852e	628d3c70-12d6-4a42-8167-c8a8dda8a209	FIRST	3663.00	586.00	147.00	EUR	12	\N
c0f010c0-ceb7-4e45-bd91-867d90f00cc5	a7be747a-5f79-4888-969d-5d65f512cd2d	FIRST	2316.00	371.00	93.00	EUR	12	\N
4da9a678-4067-4c5c-bd64-893faadbbe69	fd3b4250-b81b-4a88-9085-da83cee0fec0	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
06ffad84-e721-4739-a43e-38ccfd95274b	fd3b4250-b81b-4a88-9085-da83cee0fec0	FIRST	3663.00	586.00	147.00	EUR	12	\N
8f05d360-8806-4715-9afd-25b881db3508	cb653773-70ed-4c3d-b849-a6b088b005c1	BUSINESS	347.00	56.00	14.00	EUR	36	\N
d43685f2-4013-4eae-b674-9cbcc2bf1db2	fd7d19ef-8080-44cc-897e-ae55aca9d1d4	ECONOMY	72.00	12.00	3.00	EUR	180	\N
2cd148e1-18bc-4420-9022-bc8cabb92c48	b40522c5-bfb8-4898-81a3-cf2305812f9c	ECONOMY	72.00	12.00	3.00	EUR	180	\N
8d4b28e7-5c8e-4f7c-ab78-9734c3cfd631	caaa13a0-63ec-4dfc-a58a-040761d51290	ECONOMY	72.00	12.00	3.00	EUR	180	\N
837b2a39-3907-48b1-93bc-520eb0ca241b	b2efa9ee-2110-4ce1-83d9-6888096685a6	ECONOMY	72.00	12.00	3.00	EUR	180	\N
415f54c6-74ed-4570-a126-fadbe90fee48	be8ac7c0-e372-4ce1-bf11-4d2c1caf19dd	ECONOMY	72.00	12.00	3.00	EUR	180	\N
b1a58337-3a0a-4439-b164-c892e303e94f	b074ffb9-2324-445e-b065-93915b9afecb	ECONOMY	288.00	46.00	12.00	EUR	184	\N
5875d0e8-e20f-4c56-af40-3d4f0ecfdaa1	2098e213-5b96-4e43-a59a-d4b66325c6e5	ECONOMY	288.00	46.00	12.00	EUR	184	\N
efb6dec2-b73c-49ed-91d8-8a9891f4f195	6ed3c2d1-211f-49ae-a99e-327b1e9e9ba3	ECONOMY	106.00	17.00	4.00	EUR	180	\N
683dee42-d665-488a-b630-4982910fbe91	98c70e8e-24b3-4906-a4d7-a4c3a2c04465	ECONOMY	106.00	17.00	4.00	EUR	180	\N
909a3018-32dd-481e-b362-6e86fee6ac56	bec6f6d1-d366-4cbd-86a3-23778567f245	ECONOMY	421.00	67.00	17.00	EUR	283	\N
2e984a2b-fcb8-4aa1-ac2f-ad400753559e	d91788cf-39c1-42c2-86b9-2d13bbbbbc0d	ECONOMY	421.00	67.00	17.00	EUR	283	\N
d70e2a6c-dedc-47f7-ad11-e474c2b9e12b	39ddef31-842b-4318-a7d1-c7d4eed1e8c4	ECONOMY	421.00	67.00	17.00	EUR	283	\N
e1dd4d2d-8e46-490d-91e4-ad024c4ed720	ccbff18b-9a68-464b-b44a-ff6c1031406c	ECONOMY	608.00	97.00	24.00	EUR	328	\N
143dd9de-2a86-4bf2-a226-1dda79a73b6e	ccbff18b-9a68-464b-b44a-ff6c1031406c	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
44198ae7-7105-4cf4-8e02-b0d423ae75c9	be695162-8165-4529-97e9-3f7ea635cae0	ECONOMY	608.00	97.00	24.00	EUR	328	\N
303c4d2f-37bc-4054-b6e2-15d5b76b22b7	be695162-8165-4529-97e9-3f7ea635cae0	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
00911855-e30a-4c0c-b7a4-a676083587c8	b49e5c70-bd39-44e1-8972-ea9d505d7c37	ECONOMY	608.00	97.00	24.00	EUR	328	\N
135b01f3-dfc1-4960-945c-106537fedb9d	b49e5c70-bd39-44e1-8972-ea9d505d7c37	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
a78cf55d-ee30-46e8-a7f5-a21d939a9ab2	b49e5c70-bd39-44e1-8972-ea9d505d7c37	FIRST	3344.00	535.00	134.00	EUR	12	\N
33810a9c-6586-4d17-b3df-6e86d93d551e	34a86e71-410e-431a-8f2c-3e6eb2bfc36e	ECONOMY	666.00	107.00	27.00	EUR	328	\N
4a46dadc-9b51-4675-b994-926b4d1e4e1d	34a86e71-410e-431a-8f2c-3e6eb2bfc36e	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
c6beff67-d5e9-460f-8334-7f09c4078bc6	34a86e71-410e-431a-8f2c-3e6eb2bfc36e	FIRST	3663.00	586.00	147.00	EUR	12	\N
6b2544b0-dd61-4c57-8462-e04a321a5d6c	7aab1729-9d67-4688-8a80-cf77bf33bb9c	ECONOMY	666.00	107.00	27.00	EUR	328	\N
156625cc-f475-4c65-9e09-1b69c502d71f	7aab1729-9d67-4688-8a80-cf77bf33bb9c	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
3d334914-879c-4493-99dc-e5e83f8c54e0	7aab1729-9d67-4688-8a80-cf77bf33bb9c	FIRST	3663.00	586.00	147.00	EUR	12	\N
4c4f3400-0767-4238-96fd-14e575f6ebf1	93ca5aea-4991-4b9d-bc38-26fe1090e8a0	ECONOMY	666.00	107.00	27.00	EUR	328	\N
3086b858-44b4-49aa-a337-b3faa2413726	93ca5aea-4991-4b9d-bc38-26fe1090e8a0	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
a64ecb7f-6fbf-4027-a775-82aa57ca876f	f8db0a4e-1f7f-4b24-bbcb-3b21d6044f01	ECONOMY	340.00	54.00	14.00	EUR	184	\N
b13ed089-53d2-4550-a7e1-6dfa235ab6a1	f8db0a4e-1f7f-4b24-bbcb-3b21d6044f01	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
8c2239c5-0869-4b92-a883-0c2d8220846c	693e2a27-30d7-457e-b29a-2daf25344d6c	ECONOMY	340.00	54.00	14.00	EUR	184	\N
7bc05930-c1a4-4b9e-a438-6f4855f89c3f	693e2a27-30d7-457e-b29a-2daf25344d6c	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
4c4f8e00-f810-4796-a941-815d37912077	bda1d8a5-3d60-4abd-a434-3493fe704279	ECONOMY	340.00	54.00	14.00	EUR	184	\N
9aec95e8-ba4c-4e09-be34-5d0fea64ca9b	bda1d8a5-3d60-4abd-a434-3493fe704279	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
95e3e9ed-7d57-4c0d-9769-36cbe2fb475f	1e5518b8-c4cd-4ecc-9e56-beef36c6875a	ECONOMY	106.00	17.00	4.00	EUR	180	\N
a06e91b6-1983-4861-a404-906e4e65426b	b3c0e8bd-4d98-43e4-944e-a159d4babb5c	ECONOMY	106.00	17.00	4.00	EUR	180	\N
ba05a71e-fa0a-4ed0-ac5b-2815622c57f5	cdc5c34d-60eb-47cd-aab3-712412f205af	ECONOMY	106.00	17.00	4.00	EUR	180	\N
ef0cd87f-45d6-48a3-8f12-03c4e33daafc	ce55a67a-5535-4dd7-8416-1dc08a13aacf	BUSINESS	347.00	56.00	14.00	EUR	36	\N
1f703d85-8b4e-4fc6-b81c-62b5bf4c6824	208bbf35-8336-4095-ab3d-212274e6e19c	ECONOMY	99.00	16.00	4.00	EUR	184	\N
508cc588-3d44-481b-ab82-cb04ab638f44	208bbf35-8336-4095-ab3d-212274e6e19c	BUSINESS	347.00	56.00	14.00	EUR	36	\N
b7f2921c-87ba-46de-b42a-626e5e7a9f4a	f7d770e5-1f7f-44ee-a9fe-5ed67ec08c7c	ECONOMY	99.00	16.00	4.00	EUR	184	\N
2387168c-7aac-4dd3-b7cb-d61b98c3a284	f7d770e5-1f7f-44ee-a9fe-5ed67ec08c7c	BUSINESS	347.00	56.00	14.00	EUR	36	\N
5ede852c-33ba-4a98-a5a9-723bd45fb175	b12648d8-0661-4b71-b3e6-3641fc03216a	ECONOMY	99.00	16.00	4.00	EUR	184	\N
0b69e554-d4b1-4ce9-9341-9c6e8bbc7999	b12648d8-0661-4b71-b3e6-3641fc03216a	BUSINESS	347.00	56.00	14.00	EUR	36	\N
dc13f85e-96c2-4e5a-9c98-6faa8dda3b7f	15090651-4b86-4537-b9ea-828e1b254f91	ECONOMY	99.00	16.00	4.00	EUR	184	\N
cdb43410-bd90-4771-aaa6-e6f3811512b8	15090651-4b86-4537-b9ea-828e1b254f91	BUSINESS	347.00	56.00	14.00	EUR	36	\N
224f343a-0aa3-4e65-a53c-b7be9b2c79e9	280d8f80-3739-44a8-9808-f52b273bce1a	ECONOMY	99.00	16.00	4.00	EUR	184	\N
8f78cb5b-0622-482b-873f-bda356c58a0f	280d8f80-3739-44a8-9808-f52b273bce1a	BUSINESS	347.00	56.00	14.00	EUR	36	\N
1b6ef09d-33ee-495d-8ed1-0f1cb81f7495	e546ebf2-310c-47fc-b33a-4026582c285a	ECONOMY	288.00	46.00	12.00	EUR	184	\N
2cbbd979-f9d5-405e-9244-f220ea6af41d	e546ebf2-310c-47fc-b33a-4026582c285a	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
0c82aa2f-b3f8-4a22-bd0f-1844617f1417	b074ffb9-2324-445e-b065-93915b9afecb	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
eae4248b-0103-41a8-a688-64e517c92106	2098e213-5b96-4e43-a59a-d4b66325c6e5	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
7f2ce240-85ec-4fbc-b121-2f8e575c432e	a402b983-9893-4069-9388-d9197ca3330b	ECONOMY	288.00	46.00	12.00	EUR	184	\N
290e4aba-2e81-4747-a601-879c07fd4234	a402b983-9893-4069-9388-d9197ca3330b	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
4fd756d8-ba16-47e6-850c-dc911dc1e847	af270c88-bb2b-4fc8-bb26-e7558e6e86f2	ECONOMY	421.00	67.00	17.00	EUR	283	\N
8ccb08ff-65d2-4bc3-acd8-d9ca1aed1883	af270c88-bb2b-4fc8-bb26-e7558e6e86f2	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
37108b86-1b38-4136-9f81-82be96d0529d	a796e1fc-be9f-4309-a28b-90eb815cf32c	ECONOMY	666.00	107.00	27.00	EUR	328	\N
ff7fb8a3-95e1-4f68-a36c-39771ec96d0b	a796e1fc-be9f-4309-a28b-90eb815cf32c	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
1a39673a-d51c-4769-a45e-f51e9e2973d3	818d5802-4003-416a-833f-0b1fc8360033	FIRST	2316.00	371.00	93.00	EUR	12	\N
c87a5b6b-573c-494b-8fe1-92ccab1631f7	bec6f6d1-d366-4cbd-86a3-23778567f245	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
26f81810-5034-4b22-a90d-8b8f6b5e329a	d91788cf-39c1-42c2-86b9-2d13bbbbbc0d	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
b46ac47d-e93e-4075-925a-4e3ffe48dc1e	d91788cf-39c1-42c2-86b9-2d13bbbbbc0d	FIRST	2316.00	371.00	93.00	EUR	12	\N
b716d29b-d3ef-4aec-85d5-c2c6c3f11b3f	39ddef31-842b-4318-a7d1-c7d4eed1e8c4	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
9ed293ac-91f2-43af-a876-6b709d7ddac9	39ddef31-842b-4318-a7d1-c7d4eed1e8c4	FIRST	2316.00	371.00	93.00	EUR	12	\N
b7100a06-03d6-47af-9b79-c7a688cfc561	ccbff18b-9a68-464b-b44a-ff6c1031406c	FIRST	3344.00	535.00	134.00	EUR	12	\N
bbbe8621-46d7-4dec-872a-429915a73570	be695162-8165-4529-97e9-3f7ea635cae0	FIRST	3344.00	535.00	134.00	EUR	12	\N
3aea6387-1726-4dce-bb28-ff580ad46986	a84c61bf-1520-4598-96f0-61295f59ca03	FIRST	2316.00	371.00	93.00	EUR	12	\N
32648e9d-e5e5-4dbc-ba77-513b010c6690	4f06f910-7057-4132-8783-526dc6974a05	ECONOMY	421.00	67.00	17.00	EUR	283	\N
22aef275-ebc9-426b-83ca-1cf5b19af4d2	fadb96a8-922d-4ce6-9b54-2588cc29c8fd	ECONOMY	421.00	67.00	17.00	EUR	283	\N
f2f4fdfc-e132-4aa2-aa74-c14f9b22cfa8	a796e1fc-be9f-4309-a28b-90eb815cf32c	FIRST	3663.00	586.00	147.00	EUR	12	\N
a2dddde5-4138-4750-bcec-9d9be094ec00	fb9d6fd5-dc47-43eb-8dfa-d690c35d7739	ECONOMY	666.00	107.00	27.00	EUR	328	\N
c8a5101a-4a05-4601-8926-81b5a3025fa6	d64b4ecd-7f1e-40f1-8eaf-e240c5184b16	ECONOMY	666.00	107.00	27.00	EUR	328	\N
06eba487-e05d-4f26-8ed9-c09625465f57	d64b4ecd-7f1e-40f1-8eaf-e240c5184b16	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
dad5b8af-87ee-4d34-a9a6-c64d096f90c0	56d56b89-8864-4268-95f3-4bc618f7a59a	ECONOMY	106.00	17.00	4.00	EUR	180	\N
6abc5ffb-4eae-426f-bd8a-8ab47e6e328a	48bf5583-a584-45f8-a554-80188adf639b	ECONOMY	106.00	17.00	4.00	EUR	180	\N
a3ef6379-68de-4a3d-87ff-b43c35122d77	11258d52-8d33-449c-ad50-63e145841b19	ECONOMY	106.00	17.00	4.00	EUR	180	\N
4b158f50-8e64-403c-8a86-53b44a53d14d	e90db062-9398-4258-924a-287ca6dc044c	ECONOMY	106.00	17.00	4.00	EUR	180	\N
a823f61a-bd66-4a42-b357-ba3c1554941d	bec6f6d1-d366-4cbd-86a3-23778567f245	FIRST	2316.00	371.00	93.00	EUR	12	\N
a42d941f-ad8a-468c-8b07-1d1770bf2101	c0717d33-0571-4894-b31c-c952e8335186	ECONOMY	421.00	67.00	17.00	EUR	283	\N
7df62e8b-06b5-42fc-9cc3-0622059a7768	adc60189-10c6-473e-8307-d523eca40beb	ECONOMY	608.00	97.00	24.00	EUR	328	\N
e9604651-5c36-49d9-8d5e-becc770befb2	da31b9b0-7298-4c55-9afc-ccf4756e4d29	ECONOMY	608.00	97.00	24.00	EUR	328	\N
f1d4bc3d-99ff-4c8c-a624-ba6ed041dddc	93195374-04d8-45f6-88ef-87fb3dd797b1	ECONOMY	608.00	97.00	24.00	EUR	328	\N
5711fac2-9266-42f7-bbc0-1e15ece03efa	93195374-04d8-45f6-88ef-87fb3dd797b1	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
e3c45c11-5663-4e19-9a33-63e865f05bb6	93ca5aea-4991-4b9d-bc38-26fe1090e8a0	FIRST	3663.00	586.00	147.00	EUR	12	\N
8ae330c4-42e9-43f9-8330-062a280bc9cd	a9017125-64a6-4dee-a091-52b3eb543812	ECONOMY	666.00	107.00	27.00	EUR	328	\N
21cc2453-9455-441e-8289-dbf9670b1c81	a9017125-64a6-4dee-a091-52b3eb543812	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
22b72190-b458-47b4-a72e-c0f7758c9257	a9017125-64a6-4dee-a091-52b3eb543812	FIRST	3663.00	586.00	147.00	EUR	12	\N
afd2d25c-4fec-4b91-9a93-4b80558cb88c	a875a0ff-50d6-48fe-9c58-c1c828b7b77c	ECONOMY	666.00	107.00	27.00	EUR	328	\N
62ecc74f-f793-4778-b65e-e4347d5db844	a875a0ff-50d6-48fe-9c58-c1c828b7b77c	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
2ee7bfb9-b588-410d-805f-dd695fbfc892	a875a0ff-50d6-48fe-9c58-c1c828b7b77c	FIRST	3663.00	586.00	147.00	EUR	12	\N
aa537407-d79e-4409-830b-df56ceddeb7e	8e66e73e-4e9b-4329-bd3a-37217c3d82ba	ECONOMY	666.00	107.00	27.00	EUR	328	\N
30ae53e2-a386-40e7-90cf-5db4a7d4ac88	8e66e73e-4e9b-4329-bd3a-37217c3d82ba	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
1496d1f0-4587-4370-8cda-7fb4be3b9878	8e66e73e-4e9b-4329-bd3a-37217c3d82ba	FIRST	3663.00	586.00	147.00	EUR	12	\N
ab13b10b-525d-4a1a-90e8-40e279716b77	d52be3dc-480d-4a44-9858-401a78668937	ECONOMY	340.00	54.00	14.00	EUR	184	\N
5e79a4b4-b7c9-4910-a88d-d89b7269d763	d52be3dc-480d-4a44-9858-401a78668937	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
de1746b7-7eb6-418b-8d82-5d4e00c839fc	9b4a7914-e9f9-4648-9713-1efe851dd774	ECONOMY	340.00	54.00	14.00	EUR	184	\N
fe0a184a-38a0-498a-9d32-53b24c8a5f5a	9b4a7914-e9f9-4648-9713-1efe851dd774	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
597c7ed7-45da-41fe-9951-372e0b444770	8bdee070-3746-43cd-ba0d-32c163e0d6c6	ECONOMY	340.00	54.00	14.00	EUR	184	\N
60d3a66c-ee06-4152-96bf-6e792c7e4942	8bdee070-3746-43cd-ba0d-32c163e0d6c6	BUSINESS	1190.00	190.00	48.00	EUR	36	\N
1bd9cb5a-8d62-4eff-911e-cb41ad3cf8a8	fd1df5b6-5ded-4b6f-8f33-acac43fa456a	ECONOMY	106.00	17.00	4.00	EUR	180	\N
d7722dbf-db6f-4c7a-805d-72c386b084e2	9b139180-fe49-4d8c-b35a-c53412772bd3	ECONOMY	106.00	17.00	4.00	EUR	180	\N
1b3fcb66-cbac-45b0-b143-688c718e1abf	47746ea0-d580-4f4d-8b78-2ee3420cb9cb	ECONOMY	106.00	17.00	4.00	EUR	180	\N
7084680d-0754-4682-9875-bb282d8ec342	927b2351-859c-4488-a29a-1cce4988fe57	ECONOMY	99.00	16.00	4.00	EUR	184	\N
cf0a184d-048c-4aa4-b988-ad7b1ad4cf40	927b2351-859c-4488-a29a-1cce4988fe57	BUSINESS	347.00	56.00	14.00	EUR	36	\N
72530b3f-d54b-4e90-a311-e57debbeb3d9	42cb4e54-8bcc-4353-9dc8-bbf0b9bc50d6	ECONOMY	99.00	16.00	4.00	EUR	184	\N
a9d47593-555d-4ad3-bbe6-2558b83760ae	42cb4e54-8bcc-4353-9dc8-bbf0b9bc50d6	BUSINESS	347.00	56.00	14.00	EUR	36	\N
27aae2b0-47bf-4358-8abd-b0ce344713c0	c083c7d4-c642-4381-8e81-0eb7697a8ffe	ECONOMY	99.00	16.00	4.00	EUR	184	\N
293b3deb-dacc-4485-ab47-c6cd611dc942	c083c7d4-c642-4381-8e81-0eb7697a8ffe	BUSINESS	347.00	56.00	14.00	EUR	36	\N
651137be-906b-4848-a92c-b0425f1dbe55	830b4ca7-3285-4b19-a70f-3fe9fa175d08	ECONOMY	72.00	12.00	3.00	EUR	180	\N
08ad6b74-68ee-4c35-a02f-bc3e6137a4d7	55e9c33e-a255-4e4f-b947-f0e305f6cd59	ECONOMY	72.00	12.00	3.00	EUR	180	\N
f9af7aa2-57b5-41a5-912a-fb149519668e	f2c75628-6ae8-4f70-a726-12e106437946	ECONOMY	72.00	12.00	3.00	EUR	180	\N
596446a9-9f6a-4298-aa1d-65c71337b265	77c474b5-5bc0-46fa-9ba5-a47755d9e133	ECONOMY	288.00	46.00	12.00	EUR	184	\N
357a095c-fb8f-40d3-950e-62ee01297762	77c474b5-5bc0-46fa-9ba5-a47755d9e133	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
56a2e1c2-d81f-4622-917c-14d0b63a8c16	b8752e8c-30e3-4bbe-b178-b7e80f6bfacf	ECONOMY	288.00	46.00	12.00	EUR	184	\N
54d3cd22-a031-4895-a9e7-f870bdc83681	b8752e8c-30e3-4bbe-b178-b7e80f6bfacf	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
76306627-b8f0-43f3-ab8a-68c097c22962	41b43904-33c2-4775-ba6b-583fc458da6c	ECONOMY	288.00	46.00	12.00	EUR	184	\N
189a8352-85b9-491b-967e-041be2fa7683	41b43904-33c2-4775-ba6b-583fc458da6c	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
dcfab7e4-b04e-49a2-9f42-29fdca158a63	cc4ae44e-ae15-46c0-b987-3c38cc7ac569	ECONOMY	288.00	46.00	12.00	EUR	184	\N
ccc42bba-68a7-409d-8a45-86b37638d8a2	cc4ae44e-ae15-46c0-b987-3c38cc7ac569	BUSINESS	1008.00	161.00	40.00	EUR	36	\N
502e24da-30f8-49e3-a8da-7770385a98d7	af270c88-bb2b-4fc8-bb26-e7558e6e86f2	FIRST	2316.00	371.00	93.00	EUR	12	\N
9d3c832a-fb87-49f2-8eb9-a36eb5fcffa1	4f06f910-7057-4132-8783-526dc6974a05	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
3b297f5a-44b2-4158-867c-5eea12616e3b	fadb96a8-922d-4ce6-9b54-2588cc29c8fd	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
b117e13c-3f12-4bbc-8a2a-d52ffc353e4a	fadb96a8-922d-4ce6-9b54-2588cc29c8fd	FIRST	2316.00	371.00	93.00	EUR	12	\N
4695521e-52c8-4664-bc0b-c97122780960	e4732304-afe1-477e-9dc3-d60f10d789e1	ECONOMY	421.00	67.00	17.00	EUR	283	\N
2f831b3a-2838-4838-b1d1-2b35bf36c1a7	e4732304-afe1-477e-9dc3-d60f10d789e1	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
176a981a-7da2-4225-ad83-81c21f91bf62	e4732304-afe1-477e-9dc3-d60f10d789e1	FIRST	2316.00	371.00	93.00	EUR	12	\N
10629084-cfd9-4e68-b480-c1a77489d11d	eb2bb2aa-314e-45e3-b96c-6a55a13d4d53	ECONOMY	421.00	67.00	17.00	EUR	283	\N
b19736cf-f126-45cd-ad70-73dd20231c0f	eb2bb2aa-314e-45e3-b96c-6a55a13d4d53	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
3d1e4b8a-2947-4311-aade-f0bab2b6bb4d	fb9d6fd5-dc47-43eb-8dfa-d690c35d7739	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
44c831b7-d30a-4d51-9f13-3340ab600359	fb9d6fd5-dc47-43eb-8dfa-d690c35d7739	FIRST	3663.00	586.00	147.00	EUR	12	\N
794c7c0a-9b3d-4180-8876-7db3f3f4fb5c	d64b4ecd-7f1e-40f1-8eaf-e240c5184b16	FIRST	3663.00	586.00	147.00	EUR	12	\N
dd6a54c1-06f4-4b13-a0d4-405e6dbdd19a	81a3e37c-059f-47e6-8656-f96ff591438c	ECONOMY	421.00	67.00	17.00	EUR	283	\N
92b6d74e-157f-4737-a681-d73b5dd451fb	81a3e37c-059f-47e6-8656-f96ff591438c	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
2cfb08fb-69fe-4c3a-941d-b7a96842123c	81a3e37c-059f-47e6-8656-f96ff591438c	FIRST	2316.00	371.00	93.00	EUR	12	\N
304524fd-ffc1-4f01-bd83-25067a323336	bfa62d7d-229c-41c3-b5c7-7a6f2c9a25a3	ECONOMY	421.00	67.00	17.00	EUR	283	\N
5c0aaa1e-e4b8-48f2-ad64-a06ccc9207ec	bfa62d7d-229c-41c3-b5c7-7a6f2c9a25a3	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
3cd124ff-3dd2-4a07-9ceb-3955167991d9	adc60189-10c6-473e-8307-d523eca40beb	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
537d37aa-af26-4fc3-a02d-f8a4d388fb42	adc60189-10c6-473e-8307-d523eca40beb	FIRST	3344.00	535.00	134.00	EUR	12	\N
27c4d59d-2f7f-4e75-bf16-fa5ff2021073	da31b9b0-7298-4c55-9afc-ccf4756e4d29	BUSINESS	2128.00	340.00	85.00	EUR	24	\N
5936d07b-131d-4889-9e4e-302715de940a	da31b9b0-7298-4c55-9afc-ccf4756e4d29	FIRST	3344.00	535.00	134.00	EUR	12	\N
196220b6-9d8b-407b-a884-39d5b8ee2fb7	93195374-04d8-45f6-88ef-87fb3dd797b1	FIRST	3344.00	535.00	134.00	EUR	12	\N
27a1138d-2e98-4763-933c-4dc8a96d22b2	c0717d33-0571-4894-b31c-c952e8335186	BUSINESS	1474.00	236.00	59.00	EUR	24	\N
16cd72a0-e730-4f9d-9c43-5b3b71464315	c0717d33-0571-4894-b31c-c952e8335186	FIRST	2316.00	371.00	93.00	EUR	12	\N
25ba2842-ff59-40af-8388-77da23d4190b	bfa62d7d-229c-41c3-b5c7-7a6f2c9a25a3	FIRST	2316.00	371.00	93.00	EUR	12	\N
88d293ee-6d91-417f-a668-8c64d1957c70	a7f9f9db-fb1e-4b2c-9d19-2c581df3964b	ECONOMY	666.00	107.00	27.00	EUR	328	\N
991519a4-ca9b-4980-b5f7-04593e5e32de	a7f9f9db-fb1e-4b2c-9d19-2c581df3964b	BUSINESS	2331.00	373.00	93.00	EUR	24	\N
40ca230b-b31a-40fb-ae88-ea35548d82e0	a7f9f9db-fb1e-4b2c-9d19-2c581df3964b	FIRST	3663.00	586.00	147.00	EUR	12	\N
6ff012f3-1c02-4ce7-a44f-a0c64639dedd	4f06f910-7057-4132-8783-526dc6974a05	FIRST	2316.00	371.00	93.00	EUR	12	\N
183cdef4-6e4f-4149-9dbf-2c577a78d694	eb2bb2aa-314e-45e3-b96c-6a55a13d4d53	FIRST	2316.00	371.00	93.00	EUR	12	\N
\.


--
-- Data for Name: flight_segments; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.flight_segments (id, flight_id, segment_number, origin_airport_id, destination_airport_id, departure_time, arrival_time) FROM stdin;
9b14ce44-9a1d-4389-bb43-adcb42b0a91a	ee75fc27-0fe9-4866-b8c2-a113e9428875	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-09-30 09:00:00+03	2026-09-30 17:25:00+03
3dfaa19e-f2f5-4536-bc66-921837fc600c	e3b2fd0d-1d27-47a0-8c6c-84bc56d8dab7	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-01 09:00:00+03	2026-10-01 17:25:00+03
214e827a-5932-49af-a18f-e45e0ba34931	ee3f952d-59a9-4454-8abd-1c7dff1c7b85	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-09-30 10:30:00+03	2026-09-30 22:10:00+03
889dd12d-48fd-4b5f-b57d-51628138b27e	c1329f00-2f2a-46d1-bd1a-c8d5775613e9	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-01 10:30:00+03	2026-10-01 22:10:00+03
71e11e0f-63ce-44f7-84d8-0511bae6f4a0	8e60a38f-c109-4bcc-9dfa-a45d6716bd4e	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-09-30 11:00:00+03	2026-09-30 23:20:00+03
77485d22-02fc-428f-bf67-d330d9103274	fcf53ea0-9c6a-4648-8f83-eab616479fa5	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-01 11:00:00+03	2026-10-01 23:20:00+03
10406450-6452-43fb-9d45-9b35df8af478	4f876bb2-295b-4b7e-867f-7c4eaa7f53f3	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-09-30 12:30:00+03	2026-09-30 18:45:00+03
b3216780-71c4-465f-ae47-db38a130977c	fb1b0edd-9f4c-429a-a397-c3c5e1ac9ea5	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-01 12:30:00+03	2026-10-01 18:45:00+03
bb820672-d1e7-4a2a-b58b-ebc848e82450	596afd03-ff24-4a78-961c-06655a623edd	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-09-30 13:00:00+03	2026-09-30 15:00:00+03
865fae15-c2a2-4c55-9de9-23fa10bdf098	f7445f66-313e-403d-b995-0db964ed0a71	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-01 13:00:00+03	2026-10-01 15:00:00+03
fa8c5487-c61d-4e06-8fcf-484a36329d92	ccfbb8fe-34d7-4f69-9d1e-ec1b432339d6	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-03 09:00:00+03	2026-10-03 17:25:00+03
012e136e-2118-4a74-b75c-3b645f11b5b4	d066bf33-61f1-4984-b79f-e6bbb06aa6c0	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-04 09:00:00+03	2026-10-04 17:25:00+03
eed0dd5f-c132-4263-954c-1e0f3a24e45d	7db80102-6eb4-4c62-9ec2-e214e513a2c0	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-06 09:00:00+03	2026-10-06 17:25:00+03
895f3cb8-38ea-43d1-8fe0-20f9eba03dba	66916b93-2a6f-4123-bc5c-32fa5a054c44	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-07 09:00:00+03	2026-10-07 17:25:00+03
2e6bc09d-42ea-41c5-b85f-4652808a4df7	fba2abab-cd29-463f-88b4-33219d16b4ac	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-08 10:30:00+03	2026-10-08 22:10:00+03
1d958c15-c348-42dd-9928-1f9c4bcd49e7	2aac8ac5-0e0a-4678-b368-fba482d2acf0	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-09 10:30:00+03	2026-10-09 22:10:00+03
6f566aec-ccab-4bf4-8904-3119ca9a5fa8	13163a5d-b5e7-44be-96c3-a303384d3eb6	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-10 10:30:00+03	2026-10-10 22:10:00+03
0a2bebb3-7539-4311-b5eb-40da1ada5051	d4ba287e-52d4-41ab-814f-bf3efbd8a296	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-11 10:30:00+03	2026-10-11 22:10:00+03
85387a22-43df-4088-8154-670acff8668e	bcb6315b-e699-4081-8ef1-539fa17a4921	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-12 10:30:00+03	2026-10-12 22:10:00+03
cf298ae7-42f2-4f0b-97a3-2df51b4dc6ac	5d0e714f-c26b-4cfe-8f85-df83bd89ec6e	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-13 10:30:00+03	2026-10-13 22:10:00+03
8ea03b05-16e2-4496-81f9-7ee426d9da2c	3cad428a-af0b-4547-a07f-0ce75b549c88	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-05 10:30:00+03	2026-10-05 22:10:00+03
c1bee773-1a05-48db-bce7-a5a359d17c80	a0ba518c-d3aa-479a-b5b4-3a24e782fe08	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-02 10:30:00+03	2026-10-02 22:10:00+03
09dcfb82-565e-4229-81d2-0e4af5c372d7	f416f337-a4a4-49c5-bc93-cbe2d68607ed	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-04 10:30:00+03	2026-10-04 22:10:00+03
aa9993a6-d644-4436-b335-0a56f943fe7f	4a891611-df63-4adf-b7af-ac9fd06ad0f8	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-06 10:30:00+03	2026-10-06 22:10:00+03
40810906-a320-493b-b26a-5483f1d506f0	7e2e126f-3a7f-4175-920d-88206e151eb4	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-07 10:30:00+03	2026-10-07 22:10:00+03
a4752fe7-cabc-40fa-9d21-9aba00dfd1f6	c0eca707-f474-464e-addb-35685d7b525a	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-08 11:00:00+03	2026-10-08 23:20:00+03
b695c3bd-6b9b-40c6-8376-2574095328bf	47458bad-87f0-4db3-a156-cec07d4436a9	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-09 11:00:00+03	2026-10-09 23:20:00+03
e7969510-2d1e-4db7-9d38-726c121cf289	a87f517a-c050-4df5-a963-a0ba8aa6dad3	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-10 11:00:00+03	2026-10-10 23:20:00+03
44f889f2-d969-4dd9-992e-7560527d79bb	23e82c36-9cae-47d3-826b-08af261000ff	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-11 11:00:00+03	2026-10-11 23:20:00+03
a51cbc94-9805-4271-bb14-043a5a074181	9eda0fa6-5756-4284-85f1-0bb71bfa3ef1	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-12 11:00:00+03	2026-10-12 23:20:00+03
ac8e5d8a-0d8c-4f5b-bcd7-1307bde32f72	aa134a72-6856-401e-8bdb-ee6c0ca1be45	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-09 12:30:00+03	2026-10-09 18:45:00+03
e3617e0e-e64a-49eb-93d5-05e95d37366b	fd3b4250-b81b-4a88-9085-da83cee0fec0	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-05 11:00:00+03	2026-10-05 23:20:00+03
84bdafda-d06a-4123-a7cb-3040521c7669	9b08128a-aafa-4512-a78e-216e7130104b	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-02 11:00:00+03	2026-10-02 23:20:00+03
a62cf6dc-7e25-4128-b863-d4a1e0055bc6	a911737a-5506-477a-9ba2-0118fe2ebe0d	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-03 11:00:00+03	2026-10-03 23:20:00+03
23e64784-6dd6-4aa2-a10c-036d7f82472a	a8286216-e58e-471e-8449-c59d4602da39	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-04 11:00:00+03	2026-10-04 23:20:00+03
9964e9ef-57a1-4e34-90d5-df2ee9c25eb8	38ea5f48-c27d-4d8b-91a1-dd4b4c8d6bb4	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-06 11:00:00+03	2026-10-06 23:20:00+03
f98e7424-de28-40f3-9ff8-ada33a7ec432	89004b5a-80da-479f-b0fa-ea022d37fdae	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-07 11:00:00+03	2026-10-07 23:20:00+03
fc423d39-dfbd-4637-996a-a0ef5459042e	46e9b691-8fce-4ac0-8352-47590c2eee8a	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-10 12:30:00+03	2026-10-10 18:45:00+03
8ad461ea-9fb2-4e0b-9fdd-86afaa025954	ef128ad4-7eef-41f4-bcee-c0d9cbcaa3ba	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-11 12:30:00+03	2026-10-11 18:45:00+03
30eaedfa-dba3-4550-a8a0-f7d2365b9896	1b4ef376-54cb-4b6b-900c-877ec40b0eec	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-12 12:30:00+03	2026-10-12 18:45:00+03
70134ac1-5de6-46b4-ba6c-b71e9fa03209	478b8417-f3ff-436b-8f9d-938ddddb830c	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-13 12:30:00+03	2026-10-13 18:45:00+03
66940193-0e69-490b-8eac-480f4d883005	ebe67ce0-34d6-4512-83a8-8db97b70a8c5	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-08 13:00:00+03	2026-10-08 15:00:00+03
cdbe77e5-bdd1-4dfd-87e0-243c0b266a57	f59de4d7-d5a9-45fe-9030-ec29c3e1a558	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-09 13:00:00+03	2026-10-09 15:00:00+03
4c178615-1f79-4cb0-bb7b-0e7fb14559a2	afdec5ce-7410-4537-bb35-5f13c07e2545	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-05 12:30:00+03	2026-10-05 18:45:00+03
dcf560cd-8627-4d96-bce0-818fa697ab87	3b136e93-2343-4c5c-a3d4-b1743210aab6	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-02 12:30:00+03	2026-10-02 18:45:00+03
c35df656-d632-4926-ad82-b7e7d51ea833	ecefd8b8-335a-4887-bf2e-1ced6ce4eaaf	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-03 12:30:00+03	2026-10-03 18:45:00+03
e172997e-3137-4880-8d2d-f94272f6b5ac	7c0cbd46-0e48-4426-94cb-337e9ef31135	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-04 12:30:00+03	2026-10-04 18:45:00+03
2548581c-002a-4d1a-9490-4f17f5a73eed	24f2f45f-d2dd-4d21-8243-8e42213fbe9c	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-06 12:30:00+03	2026-10-06 18:45:00+03
fd713d1f-4fa6-4f43-919a-d44ba36e9929	d94d7a82-45b0-495e-ab90-df511b64e086	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-07 12:30:00+03	2026-10-07 18:45:00+03
8f0e578f-19c4-478c-b732-2a05aac5817d	d438d5c7-a166-4698-9a4d-bb14573bf829	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-10 13:00:00+03	2026-10-10 15:00:00+03
e5675bc8-60f8-4b4b-9820-56f1e71e9d4c	9eee9d47-9c4f-4de2-b623-046b0215b36c	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-11 13:00:00+03	2026-10-11 15:00:00+03
cedcfbf3-69ed-4fd9-978e-67505c9bb471	50f82444-a5e3-4da2-8ed1-8317ab291d7b	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-12 13:00:00+03	2026-10-12 15:00:00+03
84eed6ea-3fec-44c6-8f4b-c57d6a1bd059	85b083d5-e320-4d45-9cfd-d16083731b77	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-13 13:00:00+03	2026-10-13 15:00:00+03
140a58be-6a02-4492-a312-a90a3530b3d7	3062e613-4bfc-4bbd-8699-a5cfb7ac9c88	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-05 13:00:00+03	2026-10-05 15:00:00+03
855944b1-def6-41f8-be0c-2f20b721d2ec	451cafd1-5933-406a-8efd-b8f118826b4a	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-02 13:00:00+03	2026-10-02 15:00:00+03
422bfe18-1916-4a31-909b-29bd42a06b7e	80a805e2-9561-4f94-8c8d-12efb5ae4558	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-03 13:00:00+03	2026-10-03 15:00:00+03
dfed658e-0856-4cef-8942-6d1a5e9b86c7	5923cdf1-f997-46ad-956e-bebfc9785630	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-04 13:00:00+03	2026-10-04 15:00:00+03
cd7dc3b8-26f1-4325-9e8f-19725762b703	41bbd0d7-4490-42a2-aa71-e08349ac2844	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-06 13:00:00+03	2026-10-06 15:00:00+03
7743fc45-2695-4985-a951-9b54d3e19a08	1db470f2-964f-4bb5-99f7-d61b297536f1	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-07 13:00:00+03	2026-10-07 15:00:00+03
87c5b569-a6d1-47e7-a42a-a369139dd590	455173a4-d421-4164-9e77-48d0b9798870	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-08 09:00:00+03	2026-10-08 17:25:00+03
7dfdec14-8cfe-456e-b359-b2303ce9b8e2	a9e32a56-4d3c-415f-b617-f7b8fc453829	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-09 09:00:00+03	2026-10-09 17:25:00+03
464c6caa-403f-4d86-9d41-7d00040253ca	6324b5b2-2c7b-4949-bb01-76fc48c99363	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-10 09:00:00+03	2026-10-10 17:25:00+03
50cc674a-9d03-4be5-863d-f65eec8e4582	5c179b11-0992-4bed-a56f-d89da20452d6	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-11 09:00:00+03	2026-10-11 17:25:00+03
802ddcea-17ad-4e62-9e75-16d12f9a04fc	a1214ae0-f4de-4f20-b273-edadb5e08248	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-12 09:00:00+03	2026-10-12 17:25:00+03
90c4fce1-65c4-46f6-9597-d39bf1dba8d4	2580c8ab-904b-45b7-a934-28126b1be077	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-13 09:00:00+03	2026-10-13 17:25:00+03
6a4cf0dd-3c90-4e93-bb3d-b88903e85492	a7be747a-5f79-4888-969d-5d65f512cd2d	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-05 09:00:00+03	2026-10-05 17:25:00+03
c6ae57f4-f2b8-4348-8395-ae950ec67c3b	85603a6d-cf8a-4459-b1a9-a11d643a24cb	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-09-30 14:30:00+03	2026-09-30 16:20:00+03
fceb632e-b096-4b3a-a2f6-2d3ae6ac3c5c	ac2a881a-7b5b-4521-8233-50e1769e0478	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-01 14:30:00+03	2026-10-01 16:20:00+03
9d513a19-e310-48d1-ad81-d6820df913b7	52757b35-8ad2-43f6-b2c8-1b239861a458	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-09-30 15:00:00+03	2026-09-30 16:05:00+03
3333a211-6cd2-403c-a03f-4897e254079c	84e34adf-7d23-45a7-a646-27dbf50ef755	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-01 15:00:00+03	2026-10-01 16:05:00+03
b14f9547-e0c5-426a-8275-2779d7046c10	dc7a6c7f-81bb-4f56-90c7-521d68d8ecd3	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-09-30 22:30:00+03	2026-10-01 04:25:00+03
f8f118b7-0f8b-4ff2-8005-7e25ef1b5b55	84b8b8c1-2463-46fc-bcfb-7f74ddb663d9	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-01 22:30:00+03	2026-10-02 04:25:00+03
476fc8a1-11ee-4205-a95a-0f78949844ad	7327c98b-30ec-4141-9a86-66031f942e53	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-09-30 19:30:00+03	2026-10-01 03:55:00+03
1858e5bf-18e5-4ae6-bc66-73a4569fcacb	bd2a26fb-ee11-4641-addc-bc1d6266d5eb	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-01 23:15:00+03	2026-10-02 11:35:00+03
a756b386-ac72-4c63-ba5a-7f3ff3e90c49	039f9c11-057f-4060-a978-452f685c2db8	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-09-30 08:15:00+03	2026-09-30 10:15:00+03
411c4c28-a916-4318-b2f2-53ad0b581d0d	12875a5c-930c-44ac-8236-6f2c55275bc6	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-01 08:15:00+03	2026-10-01 10:15:00+03
854f08ee-11d3-4d74-b698-b2a11237411f	e1b36b0e-9c60-4dbf-8601-25af9e7170c9	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-02 09:00:00+03	2026-10-02 17:25:00+03
da2b2438-f1b8-421e-82b1-8bdd6cab8a3c	d7c230b2-2747-4ca8-bd2f-9b808897b7e6	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-03 10:30:00+03	2026-10-03 22:10:00+03
d4c98906-b33b-45ea-aba8-129533bb404d	6c8d996f-ef77-43a7-ad99-9e39e2026eea	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-03 14:30:00+03	2026-10-03 16:20:00+03
6928f26d-0484-4cad-9d6b-64d4b9a05ac3	2ed8024c-2fbb-4021-859b-56e09fa589c7	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-04 14:30:00+03	2026-10-04 16:20:00+03
bba80e92-1133-4d60-9e96-468a00068435	37c6416b-5c07-4bdd-bd32-9e7e427988b7	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-06 14:30:00+03	2026-10-06 16:20:00+03
45f983ce-65f9-4880-94c7-a07d437eba7a	880bec33-5d55-4055-b9d6-e0f74ea5836b	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-07 14:30:00+03	2026-10-07 16:20:00+03
b7df511e-8e04-405f-86fa-628dd5f35977	f6693ce8-ba8a-4a86-8cf4-fc0a63a544b5	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-08 15:00:00+03	2026-10-08 16:05:00+03
2354e68f-83d5-400f-b10b-fc53689ed522	04e3ccc0-8942-469f-991c-52142e688144	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-09 15:00:00+03	2026-10-09 16:05:00+03
6d2cb639-5254-4a1c-b6a9-777750f5346b	275c6977-7df8-43f0-818a-5d160070f44a	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-10 15:00:00+03	2026-10-10 16:05:00+03
ee906032-97b4-4efd-893c-8babc0dd828b	dbdc7e75-32a3-4304-ba4d-81802a32cb1a	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-11 15:00:00+03	2026-10-11 16:05:00+03
7d47213d-7fa3-4e71-8f93-808d0a398f9b	b9b562ca-3a8d-48b0-9276-49d0a7b197d7	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-12 15:00:00+03	2026-10-12 16:05:00+03
6de8f842-e178-4dd1-8e56-ce9f6c1921e1	38a44152-e0a9-4191-85c2-c5e8a4559d93	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-13 15:00:00+03	2026-10-13 16:05:00+03
d680e50e-873d-4bfa-b508-1b627e5e4b10	3066bd0f-54d9-4821-a0f0-2cf2c454a74d	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-05 15:00:00+03	2026-10-05 16:05:00+03
2623bba7-e185-4605-ba14-346b9738ec3b	e00b6cce-6792-4811-857b-e8ce1a2483c9	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-02 15:00:00+03	2026-10-02 16:05:00+03
acbb99fd-0411-4b3b-b328-8ad4e5c19e6d	3ec99e22-08e7-4135-8fc9-150c74a718d7	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-04 15:00:00+03	2026-10-04 16:05:00+03
8ec2ca69-4e17-4e9b-88a3-aaedbbd7d725	5f6d728c-0119-454a-b4ed-0607897b20ca	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-06 15:00:00+03	2026-10-06 16:05:00+03
1187bb9b-91fc-4870-9333-23e4aad08caa	a778a83a-5948-464e-be88-20b7fee45e6e	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-07 15:00:00+03	2026-10-07 16:05:00+03
b8da6cf0-3517-4cb1-a08f-061b8a1c68f7	3c8ac90d-2a87-4efe-845d-3439b4b1d989	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-08 22:30:00+03	2026-10-09 04:25:00+03
0fefd77c-66a0-496a-a0b2-8ddbb4bcd0f7	5f0a79cf-a5bc-438f-8693-f5664350f994	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-09 22:30:00+03	2026-10-10 04:25:00+03
a51fdf2d-c5f9-41fb-aa6a-316f7f6971d6	193d11df-1877-47c1-b43d-00eecbacaa98	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-10 22:30:00+03	2026-10-11 04:25:00+03
3a0022db-12d2-45fd-995e-df7df6008b2c	bedce820-8ab7-4b86-b5e5-737a2289084e	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-11 22:30:00+03	2026-10-12 04:25:00+03
50fabef1-bba5-4708-8ffd-72040274dd4c	2b521517-8cb6-48d9-947b-e075d8d9aafa	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-12 22:30:00+03	2026-10-13 04:25:00+03
2af52cbd-3b4a-4eb3-9c57-1f41921d70ee	dde1a113-f013-4b02-ab9b-8bd880904d2e	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-13 22:30:00+03	2026-10-14 04:25:00+03
972675de-0852-4555-94d9-21f8db1d24ea	b5230204-3701-4994-8988-37f9258e531e	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-05 22:30:00+03	2026-10-06 04:25:00+03
52910e89-a9b4-4f7b-9208-32b603543fde	742a0fab-8895-4302-a99c-b97f0d53f940	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-02 22:30:00+03	2026-10-03 04:25:00+03
947d6c56-22b6-42e4-999e-668765cfeea5	9a09923e-b787-4599-bc22-a3b2740ec0b4	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-03 22:30:00+03	2026-10-04 04:25:00+03
65e59872-1d62-4f95-bde2-e2825387faa7	46ab9a4c-e3f0-4f26-ba31-8021de028202	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-04 22:30:00+03	2026-10-05 04:25:00+03
b0ad5f42-3bf5-45b5-9eff-89996d449318	c9da46d2-0f00-452b-8356-87af4b6b3bee	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-06 22:30:00+03	2026-10-07 04:25:00+03
deb5792c-71cc-4ebe-a404-4ae767fcf9cc	b094f7e8-2942-40b7-809f-81a9fc806ad8	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-07 22:30:00+03	2026-10-08 04:25:00+03
bead4d27-ea05-4040-8150-e1b79831d626	70733ce0-3cf8-407b-8dc5-7e4555d1b9a6	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-09 19:30:00+03	2026-10-10 03:55:00+03
9772ec6a-f030-47e2-b0c8-344b9ff196e2	b042ffc9-d17f-4e06-a2d0-78d94d500176	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-11 19:30:00+03	2026-10-12 03:55:00+03
08fd2dbe-df9b-409d-b81b-713eb050e4a5	7c1ad5a4-aed7-4e87-9b04-e9e50196b4d3	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-08 23:15:00+03	2026-10-09 11:35:00+03
01cf6510-cb4c-4652-9660-f2bd41156a33	2f3bdbdd-e312-4bd8-b26f-c34b2d6107f7	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-10 23:15:00+03	2026-10-11 11:35:00+03
bb7719d2-4e27-49c2-9e34-700408df52aa	c61c4cc9-6fa8-4968-a9fb-e3169218a985	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-13 23:15:00+03	2026-10-14 11:35:00+03
47647be5-d0bd-4b46-9d5a-fed519c38ebc	9f101579-1c7e-4095-ab28-0a1df8a72f7a	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-08 08:15:00+03	2026-10-08 10:15:00+03
476bf93c-1ada-4b0e-a00b-aac1ba6ffe67	a84c61bf-1520-4598-96f0-61295f59ca03	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-05 19:30:00+03	2026-10-06 03:55:00+03
9a17b4a6-5f56-43ec-85ff-11fd3d612629	d8fffdfb-e549-44d1-841f-75754ed106d1	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-02 19:30:00+03	2026-10-03 03:55:00+03
f4ea7df6-496a-4d85-aa30-33de50e3fdd8	cefe8319-bb62-408c-92e6-7a5dd6834d3d	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-04 19:30:00+03	2026-10-05 03:55:00+03
83bd8d6a-b90c-4917-ba2d-c50a9ade5592	9225f50f-5fd8-49d0-9c37-39ecc46314a8	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-07 19:30:00+03	2026-10-08 03:55:00+03
666411f4-eb6d-4a21-afad-463efa419a00	0857ec3e-f50f-42c0-bbb0-0a165581739e	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-09 08:15:00+03	2026-10-09 10:15:00+03
8a868f22-e899-4ee1-a97f-52fb1221668a	48032a86-2862-41bc-ad5e-30831dd17bf6	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-12 08:15:00+03	2026-10-12 10:15:00+03
7663cf3b-0c67-4dd4-a40e-3c5049ccbb23	acb97cc1-5d6f-4bda-956a-7c4af03cd247	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-06 23:15:00+03	2026-10-07 11:35:00+03
653d0210-d405-4e25-9ffd-1fb38fd9c84a	628d3c70-12d6-4a42-8167-c8a8dda8a209	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-03 23:15:00+03	2026-10-04 11:35:00+03
31720b0b-11e5-4fa3-a082-9cc3d89c06c6	a96d8963-6988-4ecf-a6b3-2e77ff6429e3	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-13 08:15:00+03	2026-10-13 10:15:00+03
091f3d5f-3486-4db0-a322-ecefd99f2d84	818d5802-4003-416a-833f-0b1fc8360033	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-14 09:00:00+03	2026-10-14 17:25:00+03
64799ca0-8a4c-46f3-b8d1-f390450f6d31	f94aa451-e474-4ac9-bd65-a5c1ca68f4d1	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-05 08:15:00+03	2026-10-05 10:15:00+03
60f00985-6c6e-494b-8dda-07ba5967b505	dcb45d77-34e1-4333-a9ac-db8f763ea434	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-02 08:15:00+03	2026-10-02 10:15:00+03
5d77f52f-7255-4f30-89e7-36f682ea2ded	f66c2140-bb85-47ab-802d-d05ef034ad4e	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-06 08:15:00+03	2026-10-06 10:15:00+03
b935cce1-6048-4561-832d-23385ded9e36	fc9dc5a1-a972-4be8-9473-9442d5faabd4	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-07 08:15:00+03	2026-10-07 10:15:00+03
539df8a3-edfe-4af5-8998-24c1a0ee8e4f	048d508a-0875-4efb-93b1-32afa408760d	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-15 09:00:00+03	2026-10-15 17:25:00+03
3e432b88-bb46-4791-bb33-ba55bcd97336	ce55a67a-5535-4dd7-8416-1dc08a13aacf	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-08 14:30:00+03	2026-10-08 16:20:00+03
2a0c16d1-7e48-4d12-bd79-4e5e0e9a6e52	b71f1061-56b0-4cf1-8e38-9f0a1f54565a	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-09 14:30:00+03	2026-10-09 16:20:00+03
53b439fb-ecca-4185-b6c6-cc8f685e1cc1	5f8cc8fa-8dbe-42ee-8720-44f882f6b562	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-10 14:30:00+03	2026-10-10 16:20:00+03
a8f8de58-7aa5-4882-bd14-b56588b02d04	ed47d012-c65c-4b49-b5b6-22526ef1f458	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-11 14:30:00+03	2026-10-11 16:20:00+03
cde4c146-2b8c-41b7-a3e2-d731bce94fd1	38d543ed-4594-4165-97b9-dfa2485cdc82	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-12 14:30:00+03	2026-10-12 16:20:00+03
43e9b27d-22c1-4cbe-aba7-1aaffcb31f08	6b7eef8f-09c8-455f-aa9e-17e726c5f3ee	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-13 14:30:00+03	2026-10-13 16:20:00+03
1b885e21-bed7-4d1d-8b28-a17621ef522c	cb653773-70ed-4c3d-b849-a6b088b005c1	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-05 14:30:00+03	2026-10-05 16:20:00+03
887d64b0-f21b-409e-ae36-94787b3fd345	b07f558d-5181-4b79-a149-fedad1d5d936	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-02 14:30:00+03	2026-10-02 16:20:00+03
0c967feb-6b81-494a-b812-ca87a97ab027	617b993b-a4a0-47cf-95e6-ab42cf765d1f	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-03 15:00:00+03	2026-10-03 16:05:00+03
12c70d02-7692-4c6c-8126-76af6e7f4537	292c1a2f-9a6c-4c99-87b5-936e51c81add	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-15 11:00:00+03	2026-10-15 23:20:00+03
4fafd719-5202-4d69-a0c9-214c5f7ae9de	066de7a9-a60e-4dca-9c19-f0811538fa94	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-14 13:00:00+03	2026-10-14 15:00:00+03
5ab577d6-3ea5-442c-aeb7-d3b403996a7a	6baee32a-3901-479e-8158-ec4c71b49462	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-15 13:00:00+03	2026-10-15 15:00:00+03
4b01daa9-2b6e-4aaf-aace-fd59ed64d287	9b139180-fe49-4d8c-b35a-c53412772bd3	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-20 13:00:00+03	2026-10-20 15:00:00+03
517bf3cc-67b2-4ad5-81c0-37416e3855e0	47746ea0-d580-4f4d-8b78-2ee3420cb9cb	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-21 13:00:00+03	2026-10-21 15:00:00+03
87e47734-fa4d-4a33-a55e-7a8e6a2b5e2a	42cb4e54-8bcc-4353-9dc8-bbf0b9bc50d6	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-20 14:30:00+03	2026-10-20 16:20:00+03
276943d7-1c15-40e1-8c38-25186d4b75b6	c083c7d4-c642-4381-8e81-0eb7697a8ffe	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-21 14:30:00+03	2026-10-21 16:20:00+03
9ea0f842-8d28-4825-a321-ffcd02ee5cb6	2098e213-5b96-4e43-a59a-d4b66325c6e5	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-16 22:30:00+03	2026-10-17 04:25:00+03
de17f0dd-619a-4482-96d6-56e9d106abdd	a402b983-9893-4069-9388-d9197ca3330b	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-17 22:30:00+03	2026-10-18 04:25:00+03
da879516-e671-4dce-94ea-678e5a2e2aaa	4f06f910-7057-4132-8783-526dc6974a05	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-16 19:30:00+03	2026-10-17 03:55:00+03
eb5337f3-7b08-42d2-b211-1cebc447bd92	fadb96a8-922d-4ce6-9b54-2588cc29c8fd	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-18 19:30:00+03	2026-10-19 03:55:00+03
2cbbb627-23eb-469a-903f-05bebca66805	6ed3c2d1-211f-49ae-a99e-327b1e9e9ba3	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-14 08:15:00+03	2026-10-14 10:15:00+03
c5185013-6f45-45ec-b23d-ffa57dbfceb9	98c70e8e-24b3-4906-a4d7-a4c3a2c04465	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-15 08:15:00+03	2026-10-15 10:15:00+03
ec7a9109-55c9-44b5-874a-87f2a80aa59f	bec6f6d1-d366-4cbd-86a3-23778567f245	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-16 09:00:00+03	2026-10-16 17:25:00+03
7d9f2a89-6fd9-40e5-86cb-c18346d0ecc4	39ddef31-842b-4318-a7d1-c7d4eed1e8c4	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-18 09:00:00+03	2026-10-18 17:25:00+03
bd276f72-d5e7-4c57-b144-c1d7e823a794	c0717d33-0571-4894-b31c-c952e8335186	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-19 09:00:00+03	2026-10-19 17:25:00+03
1591aa37-970f-46b8-9a82-b410ba1f039b	bfa62d7d-229c-41c3-b5c7-7a6f2c9a25a3	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-21 09:00:00+03	2026-10-21 17:25:00+03
0b8ec940-5f97-4c31-9cf0-6629aa486013	59ec564b-c994-4382-8569-34cc1dc7ed88	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-14 10:30:00+03	2026-10-14 22:10:00+03
fa2bbdbe-47d3-4ec0-8327-bf8f877313a4	d9ad0cca-3b0a-4dec-9141-d62a339d214e	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-15 10:30:00+03	2026-10-15 22:10:00+03
dc625b17-7e24-4824-a3a6-1064914b2c8d	adc60189-10c6-473e-8307-d523eca40beb	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-19 10:30:00+03	2026-10-19 22:10:00+03
200b8ddd-5490-49d1-a81b-a15950e0af2d	da31b9b0-7298-4c55-9afc-ccf4756e4d29	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-20 10:30:00+03	2026-10-20 22:10:00+03
167e2bfb-145e-4dc7-bb5a-e49fface6445	93195374-04d8-45f6-88ef-87fb3dd797b1	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-21 10:30:00+03	2026-10-21 22:10:00+03
58906d88-6f14-476f-a10c-93206f94c04b	e69877e4-cbd5-414c-b067-8a08f1987e7a	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-14 11:00:00+03	2026-10-14 23:20:00+03
de8ab918-904f-43dd-b604-40309e3835b6	a875a0ff-50d6-48fe-9c58-c1c828b7b77c	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-20 11:00:00+03	2026-10-20 23:20:00+03
3823e018-4c33-4ba7-91f9-4222aec08633	8e66e73e-4e9b-4329-bd3a-37217c3d82ba	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-21 11:00:00+03	2026-10-21 23:20:00+03
016763db-974c-4bc2-b184-57f3138d988f	986c960b-1415-45a7-af4d-c7f6407fafb1	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-08 12:30:00+03	2026-10-08 18:45:00+03
b05cc1cc-14a6-4f50-9103-8347a700f737	b3e5c692-9dcc-4238-be2f-b7076e16debb	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-14 12:30:00+03	2026-10-14 18:45:00+03
d7b0b1db-d139-499a-bd38-3da4b8374a67	5f6a60b0-ebc2-409a-bf59-5308a8fcb2d6	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-15 12:30:00+03	2026-10-15 18:45:00+03
c315b729-b7ff-4e78-b667-4d4c3e35a19e	bda1d8a5-3d60-4abd-a434-3493fe704279	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-18 12:30:00+03	2026-10-18 18:45:00+03
d82a7f9c-dd8f-4485-9b45-9e95e8c0033a	d52be3dc-480d-4a44-9858-401a78668937	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-19 12:30:00+03	2026-10-19 18:45:00+03
a44a2bd9-5caf-4ef3-adc0-63671d88b325	9b4a7914-e9f9-4648-9713-1efe851dd774	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-20 12:30:00+03	2026-10-20 18:45:00+03
bdceda0e-1ee1-486c-a91b-e05b22f0ea4a	8bdee070-3746-43cd-ba0d-32c163e0d6c6	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-21 12:30:00+03	2026-10-21 18:45:00+03
bd8ef3b8-7c1d-4157-9a80-5fdf58ad4e48	fd1df5b6-5ded-4b6f-8f33-acac43fa456a	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-19 13:00:00+03	2026-10-19 15:00:00+03
55117cf7-a14e-45ae-be6a-5c6d3c15e03e	208bbf35-8336-4095-ab3d-212274e6e19c	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-14 14:30:00+03	2026-10-14 16:20:00+03
13c4506e-d41a-46c5-99e6-c4a3c8cdccc7	f7d770e5-1f7f-44ee-a9fe-5ed67ec08c7c	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-15 14:30:00+03	2026-10-15 16:20:00+03
52af27bf-5480-4ece-b260-b1517a131aee	927b2351-859c-4488-a29a-1cce4988fe57	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-19 14:30:00+03	2026-10-19 16:20:00+03
15ee8d48-9995-45d0-86d3-7941dad2d6ad	fd7d19ef-8080-44cc-897e-ae55aca9d1d4	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-14 15:00:00+03	2026-10-14 16:05:00+03
aabe8f12-bdef-4cef-b59c-be08e1dd6a3b	b40522c5-bfb8-4898-81a3-cf2305812f9c	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-15 15:00:00+03	2026-10-15 16:05:00+03
4686f86e-a413-4fcd-8ea0-4fc9770a2082	830b4ca7-3285-4b19-a70f-3fe9fa175d08	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-19 15:00:00+03	2026-10-19 16:05:00+03
23e10904-bcf2-4bcb-8869-8e38d27e3a13	77c474b5-5bc0-46fa-9ba5-a47755d9e133	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-18 22:30:00+03	2026-10-19 04:25:00+03
5bf5499a-1651-433b-9e1a-3e67de55e670	d5a91a42-60ae-4e11-a963-daa17eef9a16	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-12 19:30:00+03	2026-10-13 03:55:00+03
99cca864-1a8a-4c7d-8714-f34f5288f6fd	a796e1fc-be9f-4309-a28b-90eb815cf32c	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-15 23:15:00+03	2026-10-16 11:35:00+03
a8807c9e-951f-483a-8582-cbd368c72f43	fb9d6fd5-dc47-43eb-8dfa-d690c35d7739	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-17 23:15:00+03	2026-10-18 11:35:00+03
90768b38-ee24-4bfc-aa87-45037efb476b	56d56b89-8864-4268-95f3-4bc618f7a59a	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-16 08:15:00+03	2026-10-16 10:15:00+03
51143b9f-2f93-4df5-82a9-74cdc42a67bb	d91788cf-39c1-42c2-86b9-2d13bbbbbc0d	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-17 09:00:00+03	2026-10-17 17:25:00+03
cacae87e-dc02-40c4-8be4-4edd9a965b6e	81a3e37c-059f-47e6-8656-f96ff591438c	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-20 09:00:00+03	2026-10-20 17:25:00+03
a68dd08f-b645-4da0-ba1c-270ba9b81294	ccbff18b-9a68-464b-b44a-ff6c1031406c	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-16 10:30:00+03	2026-10-16 22:10:00+03
2a315507-737d-4201-b724-b1697891aafd	be695162-8165-4529-97e9-3f7ea635cae0	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-17 10:30:00+03	2026-10-17 22:10:00+03
815af9c9-66e3-4ffd-b6a5-47fa0e9656b8	b49e5c70-bd39-44e1-8972-ea9d505d7c37	1	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-18 10:30:00+03	2026-10-18 22:10:00+03
2805da6e-d310-4322-8f9f-74a4850e01ac	7aab1729-9d67-4688-8a80-cf77bf33bb9c	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-17 11:00:00+03	2026-10-17 23:20:00+03
13e30444-6047-48bb-b783-14e8bafbb982	93ca5aea-4991-4b9d-bc38-26fe1090e8a0	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-18 11:00:00+03	2026-10-18 23:20:00+03
a8552f2d-f56f-4962-b47d-8c9a2e9075bf	a9017125-64a6-4dee-a091-52b3eb543812	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-19 11:00:00+03	2026-10-19 23:20:00+03
0e855be3-42d7-4b0e-96a3-d5869d064562	f8db0a4e-1f7f-4b24-bbcb-3b21d6044f01	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-16 12:30:00+03	2026-10-16 18:45:00+03
abe5faae-50c2-4d6e-a694-902bb41f122f	693e2a27-30d7-457e-b29a-2daf25344d6c	1	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	2026-10-17 12:30:00+03	2026-10-17 18:45:00+03
4365a036-578b-4733-adfe-ccfaa4e67d97	1e5518b8-c4cd-4ecc-9e56-beef36c6875a	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-16 13:00:00+03	2026-10-16 15:00:00+03
fd60ba89-3f84-4027-9a06-25a2d65fbd4b	b3c0e8bd-4d98-43e4-944e-a159d4babb5c	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-17 13:00:00+03	2026-10-17 15:00:00+03
b2d46ae5-0556-4f38-b376-d954474336ee	cdc5c34d-60eb-47cd-aab3-712412f205af	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-18 13:00:00+03	2026-10-18 15:00:00+03
dda2ba12-e07b-4700-90fe-bfcf4dccd8f3	b12648d8-0661-4b71-b3e6-3641fc03216a	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-16 14:30:00+03	2026-10-16 16:20:00+03
7d17955b-349d-4d0d-b934-796eaeb47b48	15090651-4b86-4537-b9ea-828e1b254f91	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-17 14:30:00+03	2026-10-17 16:20:00+03
c0d990eb-1eac-43cd-8a85-2e5c9d3b54e4	280d8f80-3739-44a8-9808-f52b273bce1a	1	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	2026-10-18 14:30:00+03	2026-10-18 16:20:00+03
e7088bb8-1ed4-4c12-bb7b-8880fd9287c1	caaa13a0-63ec-4dfc-a58a-040761d51290	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-16 15:00:00+03	2026-10-16 16:05:00+03
53964b02-3d76-42aa-abab-0a53d47143a5	b2efa9ee-2110-4ce1-83d9-6888096685a6	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-17 15:00:00+03	2026-10-17 16:05:00+03
1203c439-7db1-41c1-a796-d103f548f658	be8ac7c0-e372-4ce1-bf11-4d2c1caf19dd	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-18 15:00:00+03	2026-10-18 16:05:00+03
b0a351b3-8f78-47bb-b946-542f9b17a0b1	af270c88-bb2b-4fc8-bb26-e7558e6e86f2	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-14 19:30:00+03	2026-10-15 03:55:00+03
c54eda6c-5f37-4dd9-add9-16f03906adae	a7f9f9db-fb1e-4b2c-9d19-2c581df3964b	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-13 11:00:00+03	2026-10-13 23:20:00+03
7ea7cdba-7432-4a14-a1ed-f843845a61c3	34a86e71-410e-431a-8f2c-3e6eb2bfc36e	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-16 11:00:00+03	2026-10-16 23:20:00+03
b8146fd0-2c0e-4153-b74b-9353caf7c258	55e9c33e-a255-4e4f-b947-f0e305f6cd59	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-20 15:00:00+03	2026-10-20 16:05:00+03
ffd8377d-da38-4cca-87f4-ce6f95802b93	f2c75628-6ae8-4f70-a726-12e106437946	1	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	2026-10-21 15:00:00+03	2026-10-21 16:05:00+03
1a78a2a1-cc51-4de4-afe6-622cafa39302	e546ebf2-310c-47fc-b33a-4026582c285a	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-14 22:30:00+03	2026-10-15 04:25:00+03
1e5c5c65-9784-473b-9381-17bdf45d182f	b074ffb9-2324-445e-b065-93915b9afecb	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-15 22:30:00+03	2026-10-16 04:25:00+03
f13cbb78-6683-4333-a5df-54813d321b3e	b8752e8c-30e3-4bbe-b178-b7e80f6bfacf	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-19 22:30:00+03	2026-10-20 04:25:00+03
d910616a-e54d-49ef-af3e-464fdcba1ba8	41b43904-33c2-4775-ba6b-583fc458da6c	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-20 22:30:00+03	2026-10-21 04:25:00+03
a3dd5cb6-ab3d-41b0-a396-5d048ffc747b	cc4ae44e-ae15-46c0-b987-3c38cc7ac569	1	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	2026-10-21 22:30:00+03	2026-10-22 04:25:00+03
d2900e36-3570-4113-918a-5f9b05b74632	e4732304-afe1-477e-9dc3-d60f10d789e1	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-19 19:30:00+03	2026-10-20 03:55:00+03
ebe210f1-69b8-4e9d-bfad-fc62d9580c69	eb2bb2aa-314e-45e3-b96c-6a55a13d4d53	1	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	2026-10-21 19:30:00+03	2026-10-22 03:55:00+03
6315e803-d9f8-4c00-9d3d-2a38bbbefc19	d64b4ecd-7f1e-40f1-8eaf-e240c5184b16	1	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	2026-10-20 23:15:00+03	2026-10-21 11:35:00+03
fbca2460-04cb-4fea-85b8-a35b6b1b9f5c	48bf5583-a584-45f8-a554-80188adf639b	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-19 08:15:00+03	2026-10-19 10:15:00+03
a3177d39-aa60-4928-91c3-98e0603b815f	11258d52-8d33-449c-ad50-63e145841b19	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-20 08:15:00+03	2026-10-20 10:15:00+03
0e118146-4881-499c-846f-63f557a1be4e	e90db062-9398-4258-924a-287ca6dc044c	1	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	2026-10-21 08:15:00+03	2026-10-21 10:15:00+03
\.


--
-- Data for Name: flights; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.flights (id, flight_number, route_id, aircraft_id, departure_time, arrival_time, status, schedule_status, created_at, updated_at, operating_date, schedule_rule_id) FROM stdin;
ee75fc27-0fe9-4866-b8c2-a113e9428875	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-09-30 09:00:00+03	2026-09-30 17:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.366+03	2026-09-30 12:51:12.366+03	2026-09-30	d681ae6c-9b2b-45da-a8ae-f7becbceb669
e3b2fd0d-1d27-47a0-8c6c-84bc56d8dab7	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-01 09:00:00+03	2026-10-01 17:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.387+03	2026-09-30 12:51:12.387+03	2026-10-01	d681ae6c-9b2b-45da-a8ae-f7becbceb669
ee3f952d-59a9-4454-8abd-1c7dff1c7b85	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-09-30 10:30:00+03	2026-09-30 22:10:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.503+03	2026-09-30 12:51:12.503+03	2026-09-30	c57ce3a8-ffa7-4074-b275-cf016cbc2344
c1329f00-2f2a-46d1-bd1a-c8d5775613e9	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-01 10:30:00+03	2026-10-01 22:10:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.512+03	2026-09-30 12:51:12.512+03	2026-10-01	c57ce3a8-ffa7-4074-b275-cf016cbc2344
8e60a38f-c109-4bcc-9dfa-a45d6716bd4e	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-09-30 11:00:00+03	2026-09-30 23:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.635+03	2026-09-30 12:51:12.635+03	2026-09-30	97adedb1-cc34-40ca-a5c8-9357b7f1927b
fcf53ea0-9c6a-4648-8f83-eab616479fa5	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-01 11:00:00+03	2026-10-01 23:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.643+03	2026-09-30 12:51:12.643+03	2026-10-01	97adedb1-cc34-40ca-a5c8-9357b7f1927b
4f876bb2-295b-4b7e-867f-7c4eaa7f53f3	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-09-30 12:30:00+03	2026-09-30 18:45:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.76+03	2026-09-30 12:51:12.76+03	2026-09-30	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
fb1b0edd-9f4c-429a-a397-c3c5e1ac9ea5	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-01 12:30:00+03	2026-10-01 18:45:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.768+03	2026-09-30 12:51:12.768+03	2026-10-01	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
ccfbb8fe-34d7-4f69-9d1e-ec1b432339d6	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-03 09:00:00+03	2026-10-03 17:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.405+03	2026-10-02 16:23:43.732+03	2026-10-03	d681ae6c-9b2b-45da-a8ae-f7becbceb669
d066bf33-61f1-4984-b79f-e6bbb06aa6c0	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-04 09:00:00+03	2026-10-04 17:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.415+03	2026-10-02 16:23:43.742+03	2026-10-04	d681ae6c-9b2b-45da-a8ae-f7becbceb669
7db80102-6eb4-4c62-9ec2-e214e513a2c0	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-06 09:00:00+03	2026-10-06 17:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.433+03	2026-10-06 02:00:00.187+03	2026-10-06	d681ae6c-9b2b-45da-a8ae-f7becbceb669
66916b93-2a6f-4123-bc5c-32fa5a054c44	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-07 09:00:00+03	2026-10-07 17:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.442+03	2026-10-06 02:00:00.198+03	2026-10-07	d681ae6c-9b2b-45da-a8ae-f7becbceb669
2aac8ac5-0e0a-4678-b368-fba482d2acf0	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-09 10:30:00+03	2026-10-09 22:10:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.581+03	2026-10-08 16:16:38.579+03	2026-10-09	c57ce3a8-ffa7-4074-b275-cf016cbc2344
13163a5d-b5e7-44be-96c3-a303384d3eb6	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-10 10:30:00+03	2026-10-10 22:10:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.599+03	2026-10-08 16:16:38.588+03	2026-10-10	c57ce3a8-ffa7-4074-b275-cf016cbc2344
d4ba287e-52d4-41ab-814f-bf3efbd8a296	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-11 10:30:00+03	2026-10-11 22:10:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.607+03	2026-10-08 16:16:38.597+03	2026-10-11	c57ce3a8-ffa7-4074-b275-cf016cbc2344
bcb6315b-e699-4081-8ef1-539fa17a4921	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-12 10:30:00+03	2026-10-12 22:10:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.616+03	2026-10-08 16:16:38.606+03	2026-10-12	c57ce3a8-ffa7-4074-b275-cf016cbc2344
5d0e714f-c26b-4cfe-8f85-df83bd89ec6e	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-13 10:30:00+03	2026-10-13 22:10:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.624+03	2026-10-08 16:16:38.614+03	2026-10-13	c57ce3a8-ffa7-4074-b275-cf016cbc2344
3cad428a-af0b-4547-a07f-0ce75b549c88	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-05 10:30:00+03	2026-10-05 22:10:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.546+03	2026-10-06 02:00:00.335+03	2026-10-05	c57ce3a8-ffa7-4074-b275-cf016cbc2344
a0ba518c-d3aa-479a-b5b4-3a24e782fe08	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-02 10:30:00+03	2026-10-02 22:10:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.521+03	2026-10-02 16:23:43.849+03	2026-10-02	c57ce3a8-ffa7-4074-b275-cf016cbc2344
d7c230b2-2747-4ca8-bd2f-9b808897b7e6	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-03 10:30:00+03	2026-10-03 22:10:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.529+03	2026-10-02 16:23:43.858+03	2026-10-03	c57ce3a8-ffa7-4074-b275-cf016cbc2344
f416f337-a4a4-49c5-bc93-cbe2d68607ed	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-04 10:30:00+03	2026-10-04 22:10:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.538+03	2026-10-02 16:23:43.866+03	2026-10-04	c57ce3a8-ffa7-4074-b275-cf016cbc2344
4a891611-df63-4adf-b7af-ac9fd06ad0f8	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-06 10:30:00+03	2026-10-06 22:10:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.555+03	2026-10-06 02:00:00.345+03	2026-10-06	c57ce3a8-ffa7-4074-b275-cf016cbc2344
7e2e126f-3a7f-4175-920d-88206e151eb4	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-07 10:30:00+03	2026-10-07 22:10:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.564+03	2026-10-06 02:00:00.354+03	2026-10-07	c57ce3a8-ffa7-4074-b275-cf016cbc2344
c0eca707-f474-464e-addb-35685d7b525a	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-08 11:00:00+03	2026-10-08 23:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.706+03	2026-10-08 16:16:38.695+03	2026-10-08	97adedb1-cc34-40ca-a5c8-9357b7f1927b
47458bad-87f0-4db3-a156-cec07d4436a9	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-09 11:00:00+03	2026-10-09 23:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.716+03	2026-10-08 16:16:38.703+03	2026-10-09	97adedb1-cc34-40ca-a5c8-9357b7f1927b
a87f517a-c050-4df5-a963-a0ba8aa6dad3	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-10 11:00:00+03	2026-10-10 23:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.724+03	2026-10-08 16:16:38.712+03	2026-10-10	97adedb1-cc34-40ca-a5c8-9357b7f1927b
23e82c36-9cae-47d3-826b-08af261000ff	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-11 11:00:00+03	2026-10-11 23:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.734+03	2026-10-08 16:16:38.72+03	2026-10-11	97adedb1-cc34-40ca-a5c8-9357b7f1927b
9eda0fa6-5756-4284-85f1-0bb71bfa3ef1	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-12 11:00:00+03	2026-10-12 23:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.743+03	2026-10-08 16:16:38.73+03	2026-10-12	97adedb1-cc34-40ca-a5c8-9357b7f1927b
986c960b-1415-45a7-af4d-c7f6407fafb1	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-08 12:30:00+03	2026-10-08 18:45:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.829+03	2026-10-08 16:16:38.817+03	2026-10-08	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
fd3b4250-b81b-4a88-9085-da83cee0fec0	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-05 11:00:00+03	2026-10-05 23:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.679+03	2026-10-06 02:00:00.469+03	2026-10-05	97adedb1-cc34-40ca-a5c8-9357b7f1927b
9b08128a-aafa-4512-a78e-216e7130104b	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-02 11:00:00+03	2026-10-02 23:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.652+03	2026-10-02 16:23:43.97+03	2026-10-02	97adedb1-cc34-40ca-a5c8-9357b7f1927b
a911737a-5506-477a-9ba2-0118fe2ebe0d	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-03 11:00:00+03	2026-10-03 23:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.66+03	2026-10-02 16:23:43.978+03	2026-10-03	97adedb1-cc34-40ca-a5c8-9357b7f1927b
a8286216-e58e-471e-8449-c59d4602da39	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-04 11:00:00+03	2026-10-04 23:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.67+03	2026-10-02 16:23:43.987+03	2026-10-04	97adedb1-cc34-40ca-a5c8-9357b7f1927b
38ea5f48-c27d-4d8b-91a1-dd4b4c8d6bb4	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-06 11:00:00+03	2026-10-06 23:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.689+03	2026-10-06 02:00:00.479+03	2026-10-06	97adedb1-cc34-40ca-a5c8-9357b7f1927b
89004b5a-80da-479f-b0fa-ea022d37fdae	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-07 11:00:00+03	2026-10-07 23:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.697+03	2026-10-06 02:00:00.487+03	2026-10-07	97adedb1-cc34-40ca-a5c8-9357b7f1927b
aa134a72-6856-401e-8bdb-ee6c0ca1be45	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-09 12:30:00+03	2026-10-09 18:45:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.837+03	2026-10-08 16:16:38.824+03	2026-10-09	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
46e9b691-8fce-4ac0-8352-47590c2eee8a	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-10 12:30:00+03	2026-10-10 18:45:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.844+03	2026-10-08 16:16:38.831+03	2026-10-10	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
1b4ef376-54cb-4b6b-900c-877ec40b0eec	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-12 12:30:00+03	2026-10-12 18:45:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.861+03	2026-10-08 16:16:38.846+03	2026-10-12	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
455173a4-d421-4164-9e77-48d0b9798870	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-08 09:00:00+03	2026-10-08 17:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.451+03	2026-10-08 16:16:38.443+03	2026-10-08	d681ae6c-9b2b-45da-a8ae-f7becbceb669
a9e32a56-4d3c-415f-b617-f7b8fc453829	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-09 09:00:00+03	2026-10-09 17:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.46+03	2026-10-08 16:16:38.458+03	2026-10-09	d681ae6c-9b2b-45da-a8ae-f7becbceb669
afdec5ce-7410-4537-bb35-5f13c07e2545	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-05 12:30:00+03	2026-10-05 18:45:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.805+03	2026-10-06 02:00:00.594+03	2026-10-05	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
3b136e93-2343-4c5c-a3d4-b1743210aab6	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-02 12:30:00+03	2026-10-02 18:45:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.775+03	2026-10-02 16:23:44.089+03	2026-10-02	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
ecefd8b8-335a-4887-bf2e-1ced6ce4eaaf	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-03 12:30:00+03	2026-10-03 18:45:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.791+03	2026-10-02 16:23:44.096+03	2026-10-03	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
7c0cbd46-0e48-4426-94cb-337e9ef31135	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-04 12:30:00+03	2026-10-04 18:45:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.799+03	2026-10-02 16:23:44.103+03	2026-10-04	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
24f2f45f-d2dd-4d21-8243-8e42213fbe9c	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-06 12:30:00+03	2026-10-06 18:45:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.814+03	2026-10-06 02:00:00.601+03	2026-10-06	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
d94d7a82-45b0-495e-ab90-df511b64e086	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-07 12:30:00+03	2026-10-07 18:45:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.822+03	2026-10-06 02:00:00.609+03	2026-10-07	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
5c179b11-0992-4bed-a56f-d89da20452d6	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-11 09:00:00+03	2026-10-11 17:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.477+03	2026-10-08 16:16:38.475+03	2026-10-11	d681ae6c-9b2b-45da-a8ae-f7becbceb669
a1214ae0-f4de-4f20-b273-edadb5e08248	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-12 09:00:00+03	2026-10-12 17:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.486+03	2026-10-08 16:16:38.484+03	2026-10-12	d681ae6c-9b2b-45da-a8ae-f7becbceb669
2580c8ab-904b-45b7-a934-28126b1be077	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-13 09:00:00+03	2026-10-13 17:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.494+03	2026-10-08 16:16:38.492+03	2026-10-13	d681ae6c-9b2b-45da-a8ae-f7becbceb669
fba2abab-cd29-463f-88b4-33219d16b4ac	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-08 10:30:00+03	2026-10-08 22:10:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.572+03	2026-10-08 16:16:38.57+03	2026-10-08	c57ce3a8-ffa7-4074-b275-cf016cbc2344
a7be747a-5f79-4888-969d-5d65f512cd2d	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-05 09:00:00+03	2026-10-05 17:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.423+03	2026-10-06 02:00:00.157+03	2026-10-05	d681ae6c-9b2b-45da-a8ae-f7becbceb669
596afd03-ff24-4a78-961c-06655a623edd	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-09-30 13:00:00+03	2026-09-30 15:00:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.901+03	2026-09-30 12:51:12.901+03	2026-09-30	31300134-dd07-4bfd-92d4-b210ddd72d9a
f7445f66-313e-403d-b995-0db964ed0a71	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-01 13:00:00+03	2026-10-01 15:00:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.909+03	2026-09-30 12:51:12.909+03	2026-10-01	31300134-dd07-4bfd-92d4-b210ddd72d9a
85603a6d-cf8a-4459-b1a9-a11d643a24cb	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-09-30 14:30:00+03	2026-09-30 16:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.031+03	2026-09-30 12:51:13.031+03	2026-09-30	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
ac2a881a-7b5b-4521-8233-50e1769e0478	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-01 14:30:00+03	2026-10-01 16:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.046+03	2026-09-30 12:51:13.046+03	2026-10-01	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
52757b35-8ad2-43f6-b2c8-1b239861a458	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-09-30 15:00:00+03	2026-09-30 16:05:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.148+03	2026-09-30 12:51:13.148+03	2026-09-30	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
84e34adf-7d23-45a7-a646-27dbf50ef755	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-01 15:00:00+03	2026-10-01 16:05:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.153+03	2026-09-30 12:51:13.153+03	2026-10-01	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
dc7a6c7f-81bb-4f56-90c7-521d68d8ecd3	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-09-30 22:30:00+03	2026-10-01 04:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.235+03	2026-09-30 12:51:13.235+03	2026-09-30	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
84b8b8c1-2463-46fc-bcfb-7f74ddb663d9	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-01 22:30:00+03	2026-10-02 04:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.242+03	2026-09-30 12:51:13.242+03	2026-10-01	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
451cafd1-5933-406a-8efd-b8f118826b4a	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-02 13:00:00+03	2026-10-02 15:00:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.924+03	2026-10-02 16:23:44.189+03	2026-10-02	31300134-dd07-4bfd-92d4-b210ddd72d9a
80a805e2-9561-4f94-8c8d-12efb5ae4558	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-03 13:00:00+03	2026-10-03 15:00:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.938+03	2026-10-02 16:23:44.194+03	2026-10-03	31300134-dd07-4bfd-92d4-b210ddd72d9a
5923cdf1-f997-46ad-956e-bebfc9785630	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-04 13:00:00+03	2026-10-04 15:00:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.946+03	2026-10-02 16:23:44.2+03	2026-10-04	31300134-dd07-4bfd-92d4-b210ddd72d9a
41bbd0d7-4490-42a2-aa71-e08349ac2844	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-06 13:00:00+03	2026-10-06 15:00:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.968+03	2026-10-06 02:00:00.71+03	2026-10-06	31300134-dd07-4bfd-92d4-b210ddd72d9a
1db470f2-964f-4bb5-99f7-d61b297536f1	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-07 13:00:00+03	2026-10-07 15:00:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.982+03	2026-10-06 02:00:00.715+03	2026-10-07	31300134-dd07-4bfd-92d4-b210ddd72d9a
b71f1061-56b0-4cf1-8e38-9f0a1f54565a	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-09 14:30:00+03	2026-10-09 16:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.104+03	2026-10-08 16:16:39.008+03	2026-10-09	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
5f8cc8fa-8dbe-42ee-8720-44f882f6b562	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-10 14:30:00+03	2026-10-10 16:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.12+03	2026-10-08 16:16:39.015+03	2026-10-10	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
ed47d012-c65c-4b49-b5b6-22526ef1f458	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-11 14:30:00+03	2026-10-11 16:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.127+03	2026-10-08 16:16:39.022+03	2026-10-11	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
38d543ed-4594-4165-97b9-dfa2485cdc82	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-12 14:30:00+03	2026-10-12 16:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.134+03	2026-10-08 16:16:39.029+03	2026-10-12	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
6b7eef8f-09c8-455f-aa9e-17e726c5f3ee	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-13 14:30:00+03	2026-10-13 16:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.141+03	2026-10-08 16:16:39.036+03	2026-10-13	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
cb653773-70ed-4c3d-b849-a6b088b005c1	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-05 14:30:00+03	2026-10-05 16:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.073+03	2026-10-06 02:00:00.784+03	2026-10-05	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
b07f558d-5181-4b79-a149-fedad1d5d936	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-02 14:30:00+03	2026-10-02 16:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.053+03	2026-10-02 16:23:44.265+03	2026-10-02	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
6c8d996f-ef77-43a7-ad99-9e39e2026eea	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-03 14:30:00+03	2026-10-03 16:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.06+03	2026-10-02 16:23:44.273+03	2026-10-03	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
2ed8024c-2fbb-4021-859b-56e09fa589c7	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-04 14:30:00+03	2026-10-04 16:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.066+03	2026-10-02 16:23:44.28+03	2026-10-04	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
37c6416b-5c07-4bdd-bd32-9e7e427988b7	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-06 14:30:00+03	2026-10-06 16:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.08+03	2026-10-06 02:00:00.791+03	2026-10-06	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
880bec33-5d55-4055-b9d6-e0f74ea5836b	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-07 14:30:00+03	2026-10-07 16:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.088+03	2026-10-06 02:00:00.798+03	2026-10-07	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
f6693ce8-ba8a-4a86-8cf4-fc0a63a544b5	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-08 15:00:00+03	2026-10-08 16:05:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.2+03	2026-10-08 16:16:39.099+03	2026-10-08	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
04e3ccc0-8942-469f-991c-52142e688144	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-09 15:00:00+03	2026-10-09 16:05:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.206+03	2026-10-08 16:16:39.104+03	2026-10-09	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
275c6977-7df8-43f0-818a-5d160070f44a	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-10 15:00:00+03	2026-10-10 16:05:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.212+03	2026-10-08 16:16:39.11+03	2026-10-10	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
dbdc7e75-32a3-4304-ba4d-81802a32cb1a	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-11 15:00:00+03	2026-10-11 16:05:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.218+03	2026-10-08 16:16:39.116+03	2026-10-11	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
b9b562ca-3a8d-48b0-9276-49d0a7b197d7	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-12 15:00:00+03	2026-10-12 16:05:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.223+03	2026-10-08 16:16:39.121+03	2026-10-12	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
38a44152-e0a9-4191-85c2-c5e8a4559d93	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-13 15:00:00+03	2026-10-13 16:05:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.229+03	2026-10-08 16:16:39.127+03	2026-10-13	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
3066bd0f-54d9-4821-a0f0-2cf2c454a74d	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-05 15:00:00+03	2026-10-05 16:05:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.174+03	2026-10-06 02:00:00.891+03	2026-10-05	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
e00b6cce-6792-4811-857b-e8ce1a2483c9	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-02 15:00:00+03	2026-10-02 16:05:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.158+03	2026-10-02 16:23:44.362+03	2026-10-02	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
617b993b-a4a0-47cf-95e6-ab42cf765d1f	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-03 15:00:00+03	2026-10-03 16:05:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.164+03	2026-10-02 16:23:44.367+03	2026-10-03	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
3ec99e22-08e7-4135-8fc9-150c74a718d7	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-04 15:00:00+03	2026-10-04 16:05:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.169+03	2026-10-02 16:23:44.373+03	2026-10-04	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
5f6d728c-0119-454a-b4ed-0607897b20ca	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-06 15:00:00+03	2026-10-06 16:05:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.187+03	2026-10-06 02:00:00.897+03	2026-10-06	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
a778a83a-5948-464e-be88-20b7fee45e6e	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-07 15:00:00+03	2026-10-07 16:05:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.193+03	2026-10-06 02:00:00.902+03	2026-10-07	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
3c8ac90d-2a87-4efe-845d-3439b4b1d989	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-08 22:30:00+03	2026-10-09 04:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.299+03	2026-10-08 16:16:39.179+03	2026-10-08	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
5f0a79cf-a5bc-438f-8693-f5664350f994	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-09 22:30:00+03	2026-10-10 04:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.306+03	2026-10-08 16:16:39.186+03	2026-10-09	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
bedce820-8ab7-4b86-b5e5-737a2289084e	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-11 22:30:00+03	2026-10-12 04:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.319+03	2026-10-08 16:16:39.199+03	2026-10-11	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
ebe67ce0-34d6-4512-83a8-8db97b70a8c5	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-08 13:00:00+03	2026-10-08 15:00:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.997+03	2026-10-08 16:16:38.92+03	2026-10-08	31300134-dd07-4bfd-92d4-b210ddd72d9a
d438d5c7-a166-4698-9a4d-bb14573bf829	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-10 13:00:00+03	2026-10-10 15:00:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.008+03	2026-10-08 16:16:38.932+03	2026-10-10	31300134-dd07-4bfd-92d4-b210ddd72d9a
b5230204-3701-4994-8988-37f9258e531e	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-05 22:30:00+03	2026-10-06 04:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.278+03	2026-10-06 02:00:00.97+03	2026-10-05	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
742a0fab-8895-4302-a99c-b97f0d53f940	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-02 22:30:00+03	2026-10-03 04:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.257+03	2026-10-02 16:23:44.44+03	2026-10-02	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
9a09923e-b787-4599-bc22-a3b2740ec0b4	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-03 22:30:00+03	2026-10-04 04:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.264+03	2026-10-02 16:23:44.446+03	2026-10-03	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
46ab9a4c-e3f0-4f26-ba31-8021de028202	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-04 22:30:00+03	2026-10-05 04:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.271+03	2026-10-02 16:23:44.453+03	2026-10-04	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
c9da46d2-0f00-452b-8356-87af4b6b3bee	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-06 22:30:00+03	2026-10-07 04:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.285+03	2026-10-06 02:00:00.977+03	2026-10-06	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
b094f7e8-2942-40b7-809f-81a9fc806ad8	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-07 22:30:00+03	2026-10-08 04:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.292+03	2026-10-06 02:00:00.984+03	2026-10-07	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
9eee9d47-9c4f-4de2-b623-046b0215b36c	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-11 13:00:00+03	2026-10-11 15:00:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.014+03	2026-10-08 16:16:38.938+03	2026-10-11	31300134-dd07-4bfd-92d4-b210ddd72d9a
50f82444-a5e3-4da2-8ed1-8317ab291d7b	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-12 13:00:00+03	2026-10-12 15:00:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.019+03	2026-10-08 16:16:38.944+03	2026-10-12	31300134-dd07-4bfd-92d4-b210ddd72d9a
85b083d5-e320-4d45-9cfd-d16083731b77	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-13 13:00:00+03	2026-10-13 15:00:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.024+03	2026-10-08 16:16:38.949+03	2026-10-13	31300134-dd07-4bfd-92d4-b210ddd72d9a
ce55a67a-5535-4dd7-8416-1dc08a13aacf	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-08 14:30:00+03	2026-10-08 16:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.095+03	2026-10-08 16:16:39.001+03	2026-10-08	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
3062e613-4bfc-4bbd-8699-a5cfb7ac9c88	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-05 13:00:00+03	2026-10-05 15:00:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.953+03	2026-10-06 02:00:00.703+03	2026-10-05	31300134-dd07-4bfd-92d4-b210ddd72d9a
7327c98b-30ec-4141-9a86-66031f942e53	NV200	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-09-30 19:30:00+03	2026-10-01 03:55:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.342+03	2026-09-30 12:51:13.342+03	2026-09-30	290a78fa-08c0-4309-b86d-673e9c94eb97
bd2a26fb-ee11-4641-addc-bc1d6266d5eb	NV201	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-01 23:15:00+03	2026-10-02 11:35:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.416+03	2026-09-30 12:51:13.416+03	2026-10-01	e17725fc-5f3c-4b7a-b1ac-4983ccb776e4
039f9c11-057f-4060-a978-452f685c2db8	NV202	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-09-30 08:15:00+03	2026-09-30 10:15:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.487+03	2026-09-30 12:51:13.487+03	2026-09-30	adf6075e-b6f9-4e5e-87c5-a37b4662cea7
12875a5c-930c-44ac-8236-6f2c55275bc6	NV202	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-01 08:15:00+03	2026-10-01 10:15:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.492+03	2026-09-30 12:51:13.492+03	2026-10-01	adf6075e-b6f9-4e5e-87c5-a37b4662cea7
e1b36b0e-9c60-4dbf-8601-25af9e7170c9	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-02 09:00:00+03	2026-10-02 17:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.397+03	2026-10-02 16:23:43.667+03	2026-10-02	d681ae6c-9b2b-45da-a8ae-f7becbceb669
af270c88-bb2b-4fc8-bb26-e7558e6e86f2	NV200	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-14 19:30:00+03	2026-10-15 03:55:00+03	SCHEDULED	ONTIME	2026-10-02 16:23:44.594+03	2026-10-08 16:16:39.301+03	2026-10-14	290a78fa-08c0-4309-b86d-673e9c94eb97
2f3bdbdd-e312-4bd8-b26f-c34b2d6107f7	NV201	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-10 23:15:00+03	2026-10-11 11:35:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.469+03	2026-10-08 16:16:39.355+03	2026-10-10	e17725fc-5f3c-4b7a-b1ac-4983ccb776e4
d8fffdfb-e549-44d1-841f-75754ed106d1	NV200	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-02 19:30:00+03	2026-10-03 03:55:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.352+03	2026-10-02 16:23:44.533+03	2026-10-02	290a78fa-08c0-4309-b86d-673e9c94eb97
cefe8319-bb62-408c-92e6-7a5dd6834d3d	NV200	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-04 19:30:00+03	2026-10-05 03:55:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.361+03	2026-10-02 16:23:44.542+03	2026-10-04	290a78fa-08c0-4309-b86d-673e9c94eb97
9225f50f-5fd8-49d0-9c37-39ecc46314a8	NV200	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-07 19:30:00+03	2026-10-08 03:55:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.38+03	2026-10-06 02:00:01.078+03	2026-10-07	290a78fa-08c0-4309-b86d-673e9c94eb97
a796e1fc-be9f-4309-a28b-90eb815cf32c	NV201	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-15 23:15:00+03	2026-10-16 11:35:00+03	SCHEDULED	ONTIME	2026-10-02 16:23:44.642+03	2026-10-08 16:16:39.371+03	2026-10-15	e17725fc-5f3c-4b7a-b1ac-4983ccb776e4
9f101579-1c7e-4095-ab28-0a1df8a72f7a	NV202	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-08 08:15:00+03	2026-10-08 10:15:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.521+03	2026-10-08 16:16:39.396+03	2026-10-08	adf6075e-b6f9-4e5e-87c5-a37b4662cea7
0857ec3e-f50f-42c0-bbb0-0a165581739e	NV202	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-09 08:15:00+03	2026-10-09 10:15:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.526+03	2026-10-08 16:16:39.401+03	2026-10-09	adf6075e-b6f9-4e5e-87c5-a37b4662cea7
48032a86-2862-41bc-ad5e-30831dd17bf6	NV202	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-12 08:15:00+03	2026-10-12 10:15:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.533+03	2026-10-08 16:16:39.407+03	2026-10-12	adf6075e-b6f9-4e5e-87c5-a37b4662cea7
628d3c70-12d6-4a42-8167-c8a8dda8a209	NV201	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-03 23:15:00+03	2026-10-04 11:35:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.425+03	2026-10-02 16:23:44.601+03	2026-10-03	e17725fc-5f3c-4b7a-b1ac-4983ccb776e4
a96d8963-6988-4ecf-a6b3-2e77ff6429e3	NV202	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-13 08:15:00+03	2026-10-13 10:15:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.539+03	2026-10-08 16:16:39.412+03	2026-10-13	adf6075e-b6f9-4e5e-87c5-a37b4662cea7
6ed3c2d1-211f-49ae-a99e-327b1e9e9ba3	NV202	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-14 08:15:00+03	2026-10-14 10:15:00+03	SCHEDULED	ONTIME	2026-10-02 16:23:44.694+03	2026-10-08 16:16:39.418+03	2026-10-14	adf6075e-b6f9-4e5e-87c5-a37b4662cea7
98c70e8e-24b3-4906-a4d7-a4c3a2c04465	NV202	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-15 08:15:00+03	2026-10-15 10:15:00+03	SCHEDULED	ONTIME	2026-10-02 16:23:44.7+03	2026-10-08 16:16:39.423+03	2026-10-15	adf6075e-b6f9-4e5e-87c5-a37b4662cea7
f94aa451-e474-4ac9-bd65-a5c1ca68f4d1	NV202	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-05 08:15:00+03	2026-10-05 10:15:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.505+03	2026-10-06 02:00:01.192+03	2026-10-05	adf6075e-b6f9-4e5e-87c5-a37b4662cea7
dcb45d77-34e1-4333-a9ac-db8f763ea434	NV202	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-02 08:15:00+03	2026-10-02 10:15:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.499+03	2026-10-02 16:23:44.65+03	2026-10-02	adf6075e-b6f9-4e5e-87c5-a37b4662cea7
f66c2140-bb85-47ab-802d-d05ef034ad4e	NV202	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-06 08:15:00+03	2026-10-06 10:15:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.51+03	2026-10-06 02:00:01.198+03	2026-10-06	adf6075e-b6f9-4e5e-87c5-a37b4662cea7
fc9dc5a1-a972-4be8-9473-9442d5faabd4	NV202	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-07 08:15:00+03	2026-10-07 10:15:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.516+03	2026-10-06 02:00:01.203+03	2026-10-07	adf6075e-b6f9-4e5e-87c5-a37b4662cea7
6324b5b2-2c7b-4949-bb01-76fc48c99363	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-10 09:00:00+03	2026-10-10 17:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.468+03	2026-10-08 16:16:38.466+03	2026-10-10	d681ae6c-9b2b-45da-a8ae-f7becbceb669
818d5802-4003-416a-833f-0b1fc8360033	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-14 09:00:00+03	2026-10-14 17:25:00+03	SCHEDULED	ONTIME	2026-10-02 16:23:43.829+03	2026-10-08 16:16:38.5+03	2026-10-14	d681ae6c-9b2b-45da-a8ae-f7becbceb669
048d508a-0875-4efb-93b1-32afa408760d	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-15 09:00:00+03	2026-10-15 17:25:00+03	SCHEDULED	ONTIME	2026-10-02 16:23:43.84+03	2026-10-08 16:16:38.509+03	2026-10-15	d681ae6c-9b2b-45da-a8ae-f7becbceb669
bec6f6d1-d366-4cbd-86a3-23778567f245	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-16 09:00:00+03	2026-10-16 17:25:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.288+03	2026-10-08 16:16:38.518+03	2026-10-16	d681ae6c-9b2b-45da-a8ae-f7becbceb669
e69877e4-cbd5-414c-b067-8a08f1987e7a	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-14 11:00:00+03	2026-10-14 23:20:00+03	SCHEDULED	ONTIME	2026-10-02 16:23:44.071+03	2026-10-08 16:16:38.747+03	2026-10-14	97adedb1-cc34-40ca-a5c8-9357b7f1927b
292c1a2f-9a6c-4c99-87b5-936e51c81add	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-15 11:00:00+03	2026-10-15 23:20:00+03	SCHEDULED	ONTIME	2026-10-02 16:23:44.081+03	2026-10-08 16:16:38.755+03	2026-10-15	97adedb1-cc34-40ca-a5c8-9357b7f1927b
ef128ad4-7eef-41f4-bcee-c0d9cbcaa3ba	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-11 12:30:00+03	2026-10-11 18:45:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.852+03	2026-10-08 16:16:38.839+03	2026-10-11	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
5f6a60b0-ebc2-409a-bf59-5308a8fcb2d6	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-15 12:30:00+03	2026-10-15 18:45:00+03	SCHEDULED	ONTIME	2026-10-02 16:23:44.182+03	2026-10-08 16:16:38.868+03	2026-10-15	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
f59de4d7-d5a9-45fe-9030-ec29c3e1a558	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-09 13:00:00+03	2026-10-09 15:00:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.002+03	2026-10-08 16:16:38.926+03	2026-10-09	31300134-dd07-4bfd-92d4-b210ddd72d9a
066de7a9-a60e-4dca-9c19-f0811538fa94	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-14 13:00:00+03	2026-10-14 15:00:00+03	SCHEDULED	ONTIME	2026-10-02 16:23:44.254+03	2026-10-08 16:16:38.955+03	2026-10-14	31300134-dd07-4bfd-92d4-b210ddd72d9a
6baee32a-3901-479e-8158-ec4c71b49462	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-15 13:00:00+03	2026-10-15 15:00:00+03	SCHEDULED	ONTIME	2026-10-02 16:23:44.26+03	2026-10-08 16:16:38.961+03	2026-10-15	31300134-dd07-4bfd-92d4-b210ddd72d9a
208bbf35-8336-4095-ab3d-212274e6e19c	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-14 14:30:00+03	2026-10-14 16:20:00+03	SCHEDULED	ONTIME	2026-10-02 16:23:44.349+03	2026-10-08 16:16:39.043+03	2026-10-14	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
f7d770e5-1f7f-44ee-a9fe-5ed67ec08c7c	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-15 14:30:00+03	2026-10-15 16:20:00+03	SCHEDULED	ONTIME	2026-10-02 16:23:44.355+03	2026-10-08 16:16:39.051+03	2026-10-15	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
fd7d19ef-8080-44cc-897e-ae55aca9d1d4	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-14 15:00:00+03	2026-10-14 16:05:00+03	SCHEDULED	ONTIME	2026-10-02 16:23:44.428+03	2026-10-08 16:16:39.133+03	2026-10-14	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
b40522c5-bfb8-4898-81a3-cf2305812f9c	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-15 15:00:00+03	2026-10-15 16:05:00+03	SCHEDULED	ONTIME	2026-10-02 16:23:44.434+03	2026-10-08 16:16:39.138+03	2026-10-15	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
193d11df-1877-47c1-b43d-00eecbacaa98	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-10 22:30:00+03	2026-10-11 04:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.312+03	2026-10-08 16:16:39.193+03	2026-10-10	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
2b521517-8cb6-48d9-947b-e075d8d9aafa	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-12 22:30:00+03	2026-10-13 04:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.326+03	2026-10-08 16:16:39.207+03	2026-10-12	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
dde1a113-f013-4b02-ab9b-8bd880904d2e	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-13 22:30:00+03	2026-10-14 04:25:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.333+03	2026-10-08 16:16:39.213+03	2026-10-13	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
e546ebf2-310c-47fc-b33a-4026582c285a	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-14 22:30:00+03	2026-10-15 04:25:00+03	SCHEDULED	ONTIME	2026-10-02 16:23:44.521+03	2026-10-08 16:16:39.22+03	2026-10-14	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
b074ffb9-2324-445e-b065-93915b9afecb	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-15 22:30:00+03	2026-10-16 04:25:00+03	SCHEDULED	ONTIME	2026-10-02 16:23:44.527+03	2026-10-08 16:16:39.227+03	2026-10-15	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
70733ce0-3cf8-407b-8dc5-7e4555d1b9a6	NV200	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-09 19:30:00+03	2026-10-10 03:55:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.389+03	2026-10-08 16:16:39.276+03	2026-10-09	290a78fa-08c0-4309-b86d-673e9c94eb97
b042ffc9-d17f-4e06-a2d0-78d94d500176	NV200	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-11 19:30:00+03	2026-10-12 03:55:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.399+03	2026-10-08 16:16:39.285+03	2026-10-11	290a78fa-08c0-4309-b86d-673e9c94eb97
d5a91a42-60ae-4e11-a963-daa17eef9a16	NV200	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-12 19:30:00+03	2026-10-13 03:55:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.407+03	2026-10-08 16:16:39.293+03	2026-10-12	290a78fa-08c0-4309-b86d-673e9c94eb97
c61c4cc9-6fa8-4968-a9fb-e3169218a985	NV201	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-13 23:15:00+03	2026-10-14 11:35:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.479+03	2026-10-08 16:16:39.363+03	2026-10-13	e17725fc-5f3c-4b7a-b1ac-4983ccb776e4
a84c61bf-1520-4598-96f0-61295f59ca03	NV200	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-05 19:30:00+03	2026-10-06 03:55:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.371+03	2026-10-06 02:00:01.069+03	2026-10-05	290a78fa-08c0-4309-b86d-673e9c94eb97
acb97cc1-5d6f-4bda-956a-7c4af03cd247	NV201	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-06 23:15:00+03	2026-10-07 11:35:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.437+03	2026-10-06 02:00:01.136+03	2026-10-06	e17725fc-5f3c-4b7a-b1ac-4983ccb776e4
d91788cf-39c1-42c2-86b9-2d13bbbbbc0d	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-17 09:00:00+03	2026-10-17 17:25:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.317+03	2026-10-08 16:16:38.526+03	2026-10-17	d681ae6c-9b2b-45da-a8ae-f7becbceb669
d9ad0cca-3b0a-4dec-9141-d62a339d214e	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-15 10:30:00+03	2026-10-15 22:10:00+03	SCHEDULED	ONTIME	2026-10-02 16:23:43.961+03	2026-10-08 16:16:38.631+03	2026-10-15	c57ce3a8-ffa7-4074-b275-cf016cbc2344
478b8417-f3ff-436b-8f9d-938ddddb830c	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-13 12:30:00+03	2026-10-13 18:45:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.886+03	2026-10-08 16:16:38.854+03	2026-10-13	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
b3e5c692-9dcc-4238-be2f-b7076e16debb	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-14 12:30:00+03	2026-10-14 18:45:00+03	SCHEDULED	ONTIME	2026-10-02 16:23:44.174+03	2026-10-08 16:16:38.861+03	2026-10-14	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
ccbff18b-9a68-464b-b44a-ff6c1031406c	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-16 10:30:00+03	2026-10-16 22:10:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.441+03	2026-10-08 16:16:38.642+03	2026-10-16	c57ce3a8-ffa7-4074-b275-cf016cbc2344
da31b9b0-7298-4c55-9afc-ccf4756e4d29	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-20 10:30:00+03	2026-10-20 22:10:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:08.641+03	2026-10-08 16:16:38.677+03	2026-10-20	c57ce3a8-ffa7-4074-b275-cf016cbc2344
93195374-04d8-45f6-88ef-87fb3dd797b1	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-21 10:30:00+03	2026-10-21 22:10:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:08.653+03	2026-10-08 16:16:38.686+03	2026-10-21	c57ce3a8-ffa7-4074-b275-cf016cbc2344
34a86e71-410e-431a-8f2c-3e6eb2bfc36e	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-16 11:00:00+03	2026-10-16 23:20:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.567+03	2026-10-08 16:16:38.764+03	2026-10-16	97adedb1-cc34-40ca-a5c8-9357b7f1927b
7aab1729-9d67-4688-8a80-cf77bf33bb9c	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-17 11:00:00+03	2026-10-17 23:20:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.576+03	2026-10-08 16:16:38.773+03	2026-10-17	97adedb1-cc34-40ca-a5c8-9357b7f1927b
8e66e73e-4e9b-4329-bd3a-37217c3d82ba	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-21 11:00:00+03	2026-10-21 23:20:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:08.822+03	2026-10-08 16:16:38.808+03	2026-10-21	97adedb1-cc34-40ca-a5c8-9357b7f1927b
f8db0a4e-1f7f-4b24-bbcb-3b21d6044f01	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-16 12:30:00+03	2026-10-16 18:45:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.681+03	2026-10-08 16:16:38.875+03	2026-10-16	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
693e2a27-30d7-457e-b29a-2daf25344d6c	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-17 12:30:00+03	2026-10-17 18:45:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.689+03	2026-10-08 16:16:38.883+03	2026-10-17	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
8bdee070-3746-43cd-ba0d-32c163e0d6c6	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-21 12:30:00+03	2026-10-21 18:45:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:08.96+03	2026-10-08 16:16:38.912+03	2026-10-21	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
1e5518b8-c4cd-4ecc-9e56-beef36c6875a	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-16 13:00:00+03	2026-10-16 15:00:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.767+03	2026-10-08 16:16:38.967+03	2026-10-16	31300134-dd07-4bfd-92d4-b210ddd72d9a
b3c0e8bd-4d98-43e4-944e-a159d4babb5c	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-17 13:00:00+03	2026-10-17 15:00:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.773+03	2026-10-08 16:16:38.973+03	2026-10-17	31300134-dd07-4bfd-92d4-b210ddd72d9a
47746ea0-d580-4f4d-8b78-2ee3420cb9cb	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-21 13:00:00+03	2026-10-21 15:00:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:09.072+03	2026-10-08 16:16:38.995+03	2026-10-21	31300134-dd07-4bfd-92d4-b210ddd72d9a
b12648d8-0661-4b71-b3e6-3641fc03216a	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-16 14:30:00+03	2026-10-16 16:20:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.869+03	2026-10-08 16:16:39.058+03	2026-10-16	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
15090651-4b86-4537-b9ea-828e1b254f91	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-17 14:30:00+03	2026-10-17 16:20:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.877+03	2026-10-08 16:16:39.065+03	2026-10-17	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
caaa13a0-63ec-4dfc-a58a-040761d51290	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-16 15:00:00+03	2026-10-16 16:05:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.953+03	2026-10-08 16:16:39.144+03	2026-10-16	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
b2efa9ee-2110-4ce1-83d9-6888096685a6	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-17 15:00:00+03	2026-10-17 16:05:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.959+03	2026-10-08 16:16:39.15+03	2026-10-17	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
be8ac7c0-e372-4ce1-bf11-4d2c1caf19dd	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-18 15:00:00+03	2026-10-18 16:05:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.964+03	2026-10-08 16:16:39.155+03	2026-10-18	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
f2c75628-6ae8-4f70-a726-12e106437946	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-21 15:00:00+03	2026-10-21 16:05:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:09.317+03	2026-10-08 16:16:39.172+03	2026-10-21	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
2098e213-5b96-4e43-a59a-d4b66325c6e5	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-16 22:30:00+03	2026-10-17 04:25:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:01.048+03	2026-10-08 16:16:39.234+03	2026-10-16	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
a402b983-9893-4069-9388-d9197ca3330b	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-17 22:30:00+03	2026-10-18 04:25:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:01.055+03	2026-10-08 16:16:39.241+03	2026-10-17	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
cc4ae44e-ae15-46c0-b987-3c38cc7ac569	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-21 22:30:00+03	2026-10-22 04:25:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:09.446+03	2026-10-08 16:16:39.269+03	2026-10-21	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
4f06f910-7057-4132-8783-526dc6974a05	NV200	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-16 19:30:00+03	2026-10-17 03:55:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:01.119+03	2026-10-08 16:16:39.311+03	2026-10-16	290a78fa-08c0-4309-b86d-673e9c94eb97
fadb96a8-922d-4ce6-9b54-2588cc29c8fd	NV200	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-18 19:30:00+03	2026-10-19 03:55:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:01.128+03	2026-10-08 16:16:39.321+03	2026-10-18	290a78fa-08c0-4309-b86d-673e9c94eb97
56d56b89-8864-4268-95f3-4bc618f7a59a	NV202	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-16 08:15:00+03	2026-10-16 10:15:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:01.242+03	2026-10-08 16:16:39.429+03	2026-10-16	adf6075e-b6f9-4e5e-87c5-a37b4662cea7
81a3e37c-059f-47e6-8656-f96ff591438c	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-20 09:00:00+03	2026-10-20 17:25:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:08.466+03	2026-10-08 16:16:38.553+03	2026-10-20	d681ae6c-9b2b-45da-a8ae-f7becbceb669
bfa62d7d-229c-41c3-b5c7-7a6f2c9a25a3	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-21 09:00:00+03	2026-10-21 17:25:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:08.479+03	2026-10-08 16:16:38.561+03	2026-10-21	d681ae6c-9b2b-45da-a8ae-f7becbceb669
59ec564b-c994-4382-8569-34cc1dc7ed88	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-14 10:30:00+03	2026-10-14 22:10:00+03	SCHEDULED	ONTIME	2026-10-02 16:23:43.953+03	2026-10-08 16:16:38.623+03	2026-10-14	c57ce3a8-ffa7-4074-b275-cf016cbc2344
be695162-8165-4529-97e9-3f7ea635cae0	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-17 10:30:00+03	2026-10-17 22:10:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.45+03	2026-10-08 16:16:38.651+03	2026-10-17	c57ce3a8-ffa7-4074-b275-cf016cbc2344
b49e5c70-bd39-44e1-8972-ea9d505d7c37	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-18 10:30:00+03	2026-10-18 22:10:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.459+03	2026-10-08 16:16:38.66+03	2026-10-18	c57ce3a8-ffa7-4074-b275-cf016cbc2344
adc60189-10c6-473e-8307-d523eca40beb	NV101	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-19 10:30:00+03	2026-10-19 22:10:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:08.628+03	2026-10-08 16:16:38.668+03	2026-10-19	c57ce3a8-ffa7-4074-b275-cf016cbc2344
93ca5aea-4991-4b9d-bc38-26fe1090e8a0	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-18 11:00:00+03	2026-10-18 23:20:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.585+03	2026-10-08 16:16:38.782+03	2026-10-18	97adedb1-cc34-40ca-a5c8-9357b7f1927b
a9017125-64a6-4dee-a091-52b3eb543812	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-19 11:00:00+03	2026-10-19 23:20:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:08.797+03	2026-10-08 16:16:38.79+03	2026-10-19	97adedb1-cc34-40ca-a5c8-9357b7f1927b
a875a0ff-50d6-48fe-9c58-c1c828b7b77c	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-20 11:00:00+03	2026-10-20 23:20:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:08.81+03	2026-10-08 16:16:38.799+03	2026-10-20	97adedb1-cc34-40ca-a5c8-9357b7f1927b
bda1d8a5-3d60-4abd-a434-3493fe704279	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-18 12:30:00+03	2026-10-18 18:45:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.696+03	2026-10-08 16:16:38.89+03	2026-10-18	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
d52be3dc-480d-4a44-9858-401a78668937	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-19 12:30:00+03	2026-10-19 18:45:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:08.941+03	2026-10-08 16:16:38.898+03	2026-10-19	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
9b4a7914-e9f9-4648-9713-1efe851dd774	NV103	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-20 12:30:00+03	2026-10-20 18:45:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:08.952+03	2026-10-08 16:16:38.905+03	2026-10-20	dfeec557-d003-458f-a2e2-ebb9b42cf3cf
cdc5c34d-60eb-47cd-aab3-712412f205af	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-18 13:00:00+03	2026-10-18 15:00:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.778+03	2026-10-08 16:16:38.978+03	2026-10-18	31300134-dd07-4bfd-92d4-b210ddd72d9a
fd1df5b6-5ded-4b6f-8f33-acac43fa456a	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-19 13:00:00+03	2026-10-19 15:00:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:09.058+03	2026-10-08 16:16:38.984+03	2026-10-19	31300134-dd07-4bfd-92d4-b210ddd72d9a
9b139180-fe49-4d8c-b35a-c53412772bd3	NV104	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-20 13:00:00+03	2026-10-20 15:00:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:09.065+03	2026-10-08 16:16:38.99+03	2026-10-20	31300134-dd07-4bfd-92d4-b210ddd72d9a
280d8f80-3739-44a8-9808-f52b273bce1a	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-18 14:30:00+03	2026-10-18 16:20:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.884+03	2026-10-08 16:16:39.071+03	2026-10-18	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
927b2351-859c-4488-a29a-1cce4988fe57	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-19 14:30:00+03	2026-10-19 16:20:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:09.186+03	2026-10-08 16:16:39.078+03	2026-10-19	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
42cb4e54-8bcc-4353-9dc8-bbf0b9bc50d6	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-20 14:30:00+03	2026-10-20 16:20:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:09.196+03	2026-10-08 16:16:39.085+03	2026-10-20	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
830b4ca7-3285-4b19-a70f-3fe9fa175d08	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-19 15:00:00+03	2026-10-19 16:05:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:09.301+03	2026-10-08 16:16:39.161+03	2026-10-19	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
55e9c33e-a255-4e4f-b947-f0e305f6cd59	NV106	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-20 15:00:00+03	2026-10-20 16:05:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:09.308+03	2026-10-08 16:16:39.166+03	2026-10-20	11cf84f0-9916-4aa3-8981-fa9dbaa078f1
77c474b5-5bc0-46fa-9ba5-a47755d9e133	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-18 22:30:00+03	2026-10-19 04:25:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:01.062+03	2026-10-08 16:16:39.248+03	2026-10-18	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
b8752e8c-30e3-4bbe-b178-b7e80f6bfacf	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-19 22:30:00+03	2026-10-20 04:25:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:09.428+03	2026-10-08 16:16:39.255+03	2026-10-19	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
41b43904-33c2-4775-ba6b-583fc458da6c	NV107	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-20 22:30:00+03	2026-10-21 04:25:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:09.437+03	2026-10-08 16:16:39.262+03	2026-10-20	71eb1bba-7416-4c04-a2ea-dbc2cdc04977
e4732304-afe1-477e-9dc3-d60f10d789e1	NV200	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-19 19:30:00+03	2026-10-20 03:55:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:09.527+03	2026-10-08 16:16:39.33+03	2026-10-19	290a78fa-08c0-4309-b86d-673e9c94eb97
eb2bb2aa-314e-45e3-b96c-6a55a13d4d53	NV200	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-21 19:30:00+03	2026-10-22 03:55:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:09.538+03	2026-10-08 16:16:39.338+03	2026-10-21	290a78fa-08c0-4309-b86d-673e9c94eb97
fb9d6fd5-dc47-43eb-8dfa-d690c35d7739	NV201	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-17 23:15:00+03	2026-10-18 11:35:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:01.183+03	2026-10-08 16:16:39.38+03	2026-10-17	e17725fc-5f3c-4b7a-b1ac-4983ccb776e4
39ddef31-842b-4318-a7d1-c7d4eed1e8c4	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-18 09:00:00+03	2026-10-18 17:25:00+03	SCHEDULED	ONTIME	2026-10-06 02:00:00.326+03	2026-10-08 16:16:38.535+03	2026-10-18	d681ae6c-9b2b-45da-a8ae-f7becbceb669
c0717d33-0571-4894-b31c-c952e8335186	NV100	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2026-10-19 09:00:00+03	2026-10-19 17:25:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:08.432+03	2026-10-08 16:16:38.544+03	2026-10-19	d681ae6c-9b2b-45da-a8ae-f7becbceb669
a7f9f9db-fb1e-4b2c-9d19-2c581df3964b	NV102	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-13 11:00:00+03	2026-10-13 23:20:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:12.752+03	2026-10-08 16:16:38.738+03	2026-10-13	97adedb1-cc34-40ca-a5c8-9357b7f1927b
c083c7d4-c642-4381-8e81-0eb7697a8ffe	NV105	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2026-10-21 14:30:00+03	2026-10-21 16:20:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:09.205+03	2026-10-08 16:16:39.092+03	2026-10-21	f26b75b3-afa9-4ef7-bf0b-cd47293e2933
7c1ad5a4-aed7-4e87-9b04-e9e50196b4d3	NV201	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-08 23:15:00+03	2026-10-09 11:35:00+03	SCHEDULED	ONTIME	2026-09-30 12:51:13.449+03	2026-10-08 16:16:39.347+03	2026-10-08	e17725fc-5f3c-4b7a-b1ac-4983ccb776e4
d64b4ecd-7f1e-40f1-8eaf-e240c5184b16	NV201	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2026-10-20 23:15:00+03	2026-10-21 11:35:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:09.605+03	2026-10-08 16:16:39.388+03	2026-10-20	e17725fc-5f3c-4b7a-b1ac-4983ccb776e4
48bf5583-a584-45f8-a554-80188adf639b	NV202	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-19 08:15:00+03	2026-10-19 10:15:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:09.672+03	2026-10-08 16:16:39.434+03	2026-10-19	adf6075e-b6f9-4e5e-87c5-a37b4662cea7
11258d52-8d33-449c-ad50-63e145841b19	NV202	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-20 08:15:00+03	2026-10-20 10:15:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:09.68+03	2026-10-08 16:16:39.44+03	2026-10-20	adf6075e-b6f9-4e5e-87c5-a37b4662cea7
e90db062-9398-4258-924a-287ca6dc044c	NV202	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2026-10-21 08:15:00+03	2026-10-21 10:15:00+03	SCHEDULED	ONTIME	2026-10-08 14:41:09.687+03	2026-10-08 16:16:39.445+03	2026-10-21	adf6075e-b6f9-4e5e-87c5-a37b4662cea7
\.


--
-- Data for Name: loyalty_accounts; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.loyalty_accounts (id, user_id, member_number, tier, balance, created_at, updated_at) FROM stdin;
d69cd6e6-9574-47a5-9f3c-0190481a397c	34eedc56-29ef-4665-87fa-648c6a23dc72	NV66780769	SILVER	12500	2026-09-30 12:51:13.603+03	2026-09-30 12:51:13.603+03
\.


--
-- Data for Name: loyalty_transactions; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.loyalty_transactions (id, loyalty_account_id, booking_id, amount, type, description, created_at) FROM stdin;
\.


--
-- Data for Name: notification_templates; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.notification_templates (id, code, subject, body, channel) FROM stdin;
\.


--
-- Data for Name: notifications; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.notifications (id, user_id, booking_id, template_id, channel, status, content, error, sent_at, created_at) FROM stdin;
\.


--
-- Data for Name: offers; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.offers (id, title, description, badge, destination, offer_value, terms, image_url, status, valid_from, valid_until, created_at, updated_at, cabin_class, discount_type, discount_value, route_id) FROM stdin;
c482d2cc-79fc-47f3-a47e-18c7d7a21481	NovaAir Business Saver	Save 15% on the Business Class base fare to New York — flat beds, lounge access, and priority everything.	−15% Business	Frankfurt → New York	−15% on Business base fare	Bookable Business Class discount on NV100/NV200 departures Frankfurt → New York. Discount applies to the base fare only; taxes and fees excluded.	assets/img/dest-nyc.jpg	ACTIVE	2026-09-30	2026-12-06	2026-10-08 14:43:17.918+03	2026-10-08 16:16:39.479+03	BUSINESS	PERCENT	15.00	943532db-69c1-4884-85c6-2cfa694b514f
f08fda76-3ccd-4260-842d-3900aa8ee888	NovaAir Weekend Escape	€120 off the Economy base fare to Dubai — trade the weekend rain for winter sun.	−€120 Economy	Frankfurt → Dubai	−€120 on Economy base fare	Bookable Economy discount on NV103 departures Frankfurt → Dubai. Discount applies to the base fare only; taxes and fees excluded.	assets/img/dest-dubai.jpg	ACTIVE	2026-09-30	2026-12-06	2026-10-08 14:43:17.921+03	2026-10-08 16:16:39.481+03	ECONOMY	FIXED_AMOUNT	120.00	e71881e6-2ac8-4a16-b765-49e8b606b164
d4b1991e-e820-4073-903e-6cd147c0104c	NovaAir Seasonal Fare	10% off the base fare across the whole NovaAir network, every cabin, all season.	−10% network-wide	NovaAir network	−10% on base fare	Bookable discount on all routes and cabins. Discount applies to the base fare only; taxes and fees excluded.	\N	ACTIVE	2026-09-30	2026-12-06	2026-10-08 14:43:17.922+03	2026-10-08 16:16:39.483+03	\N	PERCENT	10.00	\N
df2b7d7e-2d7f-49da-86bc-0420c555652f	NovaAir Economy Escape	12% off the Economy base fare on any NovaAir route — pick a city and go.	−12% Economy	NovaAir network	−12% on Economy base fare	Bookable Economy discount on all routes. Discount applies to the base fare only; taxes and fees excluded.	\N	ACTIVE	2026-09-30	2026-12-06	2026-10-08 14:43:17.924+03	2026-10-08 16:16:39.484+03	ECONOMY	PERCENT	12.00	\N
fa95a7d1-764c-47b6-9529-13720cea4b58	NovaAir Summer Collection	Hand-picked summer destinations across the NovaAir network — browse the collection.	Summer picks	NovaAir network	\N	\N	\N	ACTIVE	2026-09-30	2026-12-06	2026-10-08 14:43:17.925+03	2026-10-08 16:16:39.486+03	\N	\N	\N	\N
71c0cb7b-1b52-4709-96a3-b2baf93aa01f	Winter Sun in Dubai	Trade the cold for the coast — daily nonstop flights and a free date change on this fare.	Winter sun	Frankfurt → Dubai	from €349	One-way Economy fare, taxes included. Free one-time date change up to 7 days before departure.	assets/img/dest-dubai.jpg	ACTIVE	2026-09-30	2026-12-06	2026-09-30 12:51:13.624+03	2026-10-08 16:16:39.471+03	\N	\N	\N	\N
903f3a5d-8f99-4a50-99f6-9b8c2eef9658	Paris Weekend Escape	One hour in the air, a weekend in the City of Light — up to six flights a day.	City break	Frankfurt → Paris	from €99	One-way Economy Light fare, hand baggage only. Year-round departures.	assets/img/dest-paris.jpg	ACTIVE	2026-09-30	2026-12-06	2026-09-30 12:51:13.625+03	2026-10-08 16:16:39.473+03	\N	\N	\N	\N
82b82d68-2c9e-4152-89f5-b802c1878947	Singapore Early Bird	Night flights and our newest cabin, nonstop to Changi — book early and save.	Early bird	Frankfurt → Singapore	from €549	One-way Economy fare with extra 10 kg baggage allowance. Booking window limited.	assets/img/dest-singapore.jpg	ACTIVE	2026-09-30	2026-12-06	2026-09-30 12:51:13.626+03	2026-10-08 16:16:39.474+03	\N	\N	\N	\N
32cbb37d-3afd-4008-8895-c2642958e062	Transatlantic Business	Fully flat seats, lounge access, and priority everything on our flagship route to New York.	−30% Business	Frankfurt → New York	from €1,899	One-way Business Class fare, taxes included. Subject to availability on NV100/NV200 departures.	assets/img/dest-nyc.jpg	INACTIVE	2026-09-30	2026-12-06	2026-09-30 12:51:13.619+03	2026-10-12 15:33:43.745+03	\N	\N	\N	\N
e507723f-0e09-4ec4-95d2-ae61ccd5f8c6	West Coast Family Getaway	Golden-hour arrivals on our afternoon nonstop service to Los Angeles.	Family fare	Frankfurt → Los Angeles	from €329	One-way Economy fare, free standard seat selection for families of 3+.	assets/img/dest-la.jpg	ACTIVE	2026-09-30	2026-12-06	2026-09-30 12:51:13.627+03	2026-10-08 16:16:39.475+03	\N	\N	\N	\N
3a55971e-0cff-4557-a00a-8ed4df5df59f	Summer 2027 Sneak Preview	Something is taking off next summer. Watch this space.	Coming soon	NovaAir network	\N	\N	\N	DRAFT	2026-09-30	2026-12-06	2026-10-08 14:41:09.832+03	2026-10-08 16:16:39.476+03	\N	\N	\N	\N
\.


--
-- Data for Name: orphan_provider_refunds; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.orphan_provider_refunds (id, provider, provider_refund_reference, payment_provider_reference, amount, currency, status, first_seen_at, last_seen_at, resolved_at, resolved_by, resolution_note, created_at, updated_at) FROM stdin;
\.


--
-- Data for Name: passengers; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.passengers (id, user_id, first_name, last_name, date_of_birth, passport_number, nationality, created_at, updated_at) FROM stdin;
72f3e5e8-0716-4570-959a-80677272a607	34eedc56-29ef-4665-87fa-648c6a23dc72	Demo	Customer	\N	\N	\N	2026-09-30 12:51:13.565+03	2026-09-30 12:51:13.565+03
af1ba579-8dcb-48c9-a6e5-60b922285582	34eedc56-29ef-4665-87fa-648c6a23dc72	Demo	Customer	\N	\N	\N	2026-09-30 12:51:13.589+03	2026-09-30 12:51:13.589+03
6dac4637-8265-49fc-993d-57824c60d84c	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Amir	Hanna	2000-11-30	4635755442	Egyptian	2026-09-30 22:15:32.413+03	2026-09-30 22:15:32.413+03
3ac84585-768c-4d64-931c-35fb77a9af79	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Amir	Hanna	2000-11-05	3201518458	Egyptian	2026-10-05 18:27:04.935+03	2026-10-05 18:27:04.935+03
ef1a0ed7-8f37-4145-9182-1811437cf315	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	fatma	anwar	2001-12-05	0356461202	Egyptian	2026-10-05 19:16:33.33+03	2026-10-05 19:16:33.33+03
30628ba1-8e57-4d12-a004-4fc55383e326	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mon	aaa	2000-02-06	424542542	Egyptian	2026-10-06 02:02:35.626+03	2026-10-06 02:02:35.626+03
ed325aea-e960-4360-b77b-d9eae6c633ba	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Amir	Hanna	2000-02-06	5051520202	Egyptian	2026-10-06 15:34:52.405+03	2026-10-06 15:34:52.405+03
8429b625-9f5e-47d7-b263-6b01d171cc62	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Ramy	Sabry	1999-12-06	8722225552	Germany	2026-10-06 15:58:38.328+03	2026-10-06 15:58:38.328+03
484452ad-b788-43d4-b71a-ae76a5fb5c70	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	op	op	2000-07-06	342454545	Germany	2026-10-06 16:31:32.891+03	2026-10-06 16:31:32.891+03
935ff413-9828-4189-9917-c409a6e427e6	34eedc56-29ef-4665-87fa-648c6a23dc72	E2E	Verifier	\N	\N	\N	2026-10-06 16:43:48.92+03	2026-10-06 16:43:48.92+03
21710dac-e8c0-4311-986f-461fcbf83010	34eedc56-29ef-4665-87fa-648c6a23dc72	E2E	Verifier	\N	\N	\N	2026-10-06 16:46:00.563+03	2026-10-06 16:46:00.563+03
48a404f6-e24b-4716-bade-b4f77ac19950	34eedc56-29ef-4665-87fa-648c6a23dc72	E2E	Verifier	\N	\N	\N	2026-10-06 16:47:00.174+03	2026-10-06 16:47:00.174+03
1e5b2c6c-f1cd-4c64-b061-7d0d08fb71f9	34eedc56-29ef-4665-87fa-648c6a23dc72	E2E	Verifier	\N	\N	\N	2026-10-06 16:49:28.323+03	2026-10-06 16:49:28.323+03
17b97463-4394-4eb2-b16b-239ae01be365	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	ppp	ooo	2000-08-06	98765432	Egyptian	2026-10-06 17:32:56.846+03	2026-10-06 17:32:56.846+03
d6c4a946-d0eb-4c08-b069-71d68c8cdc4f	34eedc56-29ef-4665-87fa-648c6a23dc72	E2E	Verifier	\N	\N	\N	2026-10-06 17:54:57.915+03	2026-10-06 17:54:57.915+03
a55ad360-9716-4226-b02f-286695219280	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	ooo	fhghf	2003-07-07	wrttrrtw	Egyptian	2026-10-06 17:58:11.339+03	2026-10-06 17:58:11.339+03
023ec908-1390-4e60-af05-05f5621ac6b6	34eedc56-29ef-4665-87fa-648c6a23dc72	E2E	Verifier	\N	\N	\N	2026-10-06 18:13:54.098+03	2026-10-06 18:13:54.098+03
7c1485b9-8196-4f1a-acc9-661830d11e88	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	sdsdsd	dsdsd	2002-02-06	58110202	Germany	2026-10-06 18:30:04.453+03	2026-10-06 18:30:04.453+03
ca0cd470-5c56-43f3-b70e-d169d5dcb484	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	memo	nono	2002-11-06	2345676543	Germany	2026-10-06 23:42:18.98+03	2026-10-06 23:42:18.98+03
f2344ead-5969-4298-8ad4-38c04225a014	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	mmm	nnn	2001-02-28	5253421114	Egyptian	2026-10-07 12:28:45.79+03	2026-10-07 12:28:45.79+03
10b7b230-d58b-46fc-8dc7-8b22a8a570ff	24e598b1-ee10-457d-83bc-122a7e1ba398	Ahmed	shaban	2000-08-05	12345678	Egyptian	2026-10-07 15:11:05.141+03	2026-10-07 15:11:05.141+03
39e4bdd8-8c3f-4927-8970-d51f87763143	24e598b1-ee10-457d-83bc-122a7e1ba398	Ahmed	shaban	2000-08-05	12345678	Egyptian	2026-10-08 14:23:47.637+03	2026-10-08 14:23:47.637+03
bcf8d628-73a1-406c-918e-ba1704f95322	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Amir	Hanna	2000-11-01	123456	Egyptian	2026-10-08 14:55:42.365+03	2026-10-08 14:55:42.365+03
d021c19f-6b2f-4321-878b-28015725ae5e	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Amir	Hanna	2000-06-08	123456789	Egyptian	2026-10-08 17:37:22.258+03	2026-10-08 17:37:22.258+03
efe096a5-4c89-4f5b-b75f-a07c57777a3a	24e598b1-ee10-457d-83bc-122a7e1ba398	Abdo	mohamed	1991-06-04	12345678	Egyptian	2026-10-12 00:27:08.086+03	2026-10-12 00:27:08.086+03
a7c0fc12-1456-41c2-82bd-1aa57e1a1982	24e598b1-ee10-457d-83bc-122a7e1ba398	Ahmed	shaban	2003-07-12	123456	Germany	2026-10-12 11:59:31.504+03	2026-10-12 11:59:31.504+03
397a5e8a-8fcf-423f-b194-3c2841f38062	c420004f-c75c-4c25-947e-d9d0e6c3aa44	Baher	Ayman	1999-05-12	12345678	Egyptian	2026-10-12 15:06:45.728+03	2026-10-12 15:06:45.728+03
4d85e12b-e076-4b61-b1b3-f1a57bd429c3	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	momo	momo	2000-07-12	123456	Egyptian	2026-10-13 15:56:42.728+03	2026-10-13 15:56:42.728+03
7b4691a4-a547-4cf5-97ad-71e32c81fb4e	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Amir	Hanna	2000-03-01	123456	Germany	2026-10-13 17:32:06.689+03	2026-10-13 17:32:06.689+03
1b67c87a-3797-428d-bc29-791cba8b5d5c	c420004f-c75c-4c25-947e-d9d0e6c3aa44	Baher	Ayman	1998-10-13	1234567	Egyptian	2026-10-13 19:17:12.941+03	2026-10-13 19:17:12.941+03
\.


--
-- Data for Name: password_reset_tokens; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.password_reset_tokens (id, user_id, token_hash, expires_at, used_at, created_at) FROM stdin;
\.


--
-- Data for Name: payment_webhook_events; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.payment_webhook_events (id, provider, event_id, event_type, status, processing_error, received_at, processed_at) FROM stdin;
c88329cc-818f-46b0-b8f2-7187a5c77c3a	stripe	evt_3UNYSyRplmQkGUx51paBbLSh	payment_intent.created	IGNORED	unsupported event type: payment_intent.created	2026-10-06 16:31:37.346+03	2026-10-06 16:31:37.351+03
61356c15-eed1-47ff-b5b2-b685d335c24e	stripe	evt_3UNYf8RplmQkGUx508cmxGs9	payment_intent.created	IGNORED	unsupported event type: payment_intent.created	2026-10-06 16:44:11.184+03	2026-10-06 16:44:11.187+03
078126f7-595d-479a-ae83-e74d4524e597	stripe	evt_3UNYf8RplmQkGUx50xba6lLk	payment_intent.succeeded	PROCESSED	\N	2026-10-06 16:44:33.645+03	2026-10-06 16:44:33.672+03
9d8f9a39-3e10-497d-b190-d229b57a0546	stripe	evt_3UNYf8RplmQkGUx50hMtKUHb	charge.succeeded	IGNORED	unsupported event type: charge.succeeded	2026-10-06 16:44:33.68+03	2026-10-06 16:44:33.68+03
6c81fe2b-bd8b-48b3-b393-826fa823e9dc	stripe	evt_3UNYf8RplmQkGUx50Id8T4Jk	charge.updated	IGNORED	unsupported event type: charge.updated	2026-10-06 16:44:36.258+03	2026-10-06 16:44:36.259+03
ba4ba1e9-05f6-4eb3-bcf5-a3ba5b3691e1	stripe	evt_3UNYgvRplmQkGUx51xP7U3dZ	payment_intent.created	IGNORED	unsupported event type: payment_intent.created	2026-10-06 16:46:01.451+03	2026-10-06 16:46:01.452+03
74242edd-6666-41d8-98bf-7ceeb802897a	stripe	evt_3UNYgvRplmQkGUx51cXDyUCS	charge.failed	IGNORED	unsupported event type: charge.failed	2026-10-06 16:46:03.152+03	2026-10-06 16:46:03.153+03
c0d2846c-7cb7-427d-a9ef-c3b7da9413fc	stripe	evt_3UNYgvRplmQkGUx51ry2p0hx	payment_intent.payment_failed	PROCESSED	\N	2026-10-06 16:46:03.235+03	2026-10-06 16:46:03.24+03
db1fb958-aa9e-4659-b344-c153a1ac4675	stripe	evt_3UNYhPRplmQkGUx50qPSMhdo	payment_intent.created	IGNORED	unsupported event type: payment_intent.created	2026-10-06 16:46:31.39+03	2026-10-06 16:46:31.39+03
e559203a-6520-4d6b-bd80-48b27f582903	stripe	evt_3UNYhsRplmQkGUx50ZmwuuQ4	payment_intent.created	IGNORED	unsupported event type: payment_intent.created	2026-10-06 16:47:01.045+03	2026-10-06 16:47:01.045+03
3c853fae-f9f1-4e4c-a80b-e2ffc6d55722	stripe	evt_3UNYhsRplmQkGUx50JsDDDJB	payment_intent.requires_action	PROCESSED	\N	2026-10-06 16:47:02.157+03	2026-10-06 16:47:02.16+03
b7e443fa-11e2-4a7b-b653-cf9a1b8b3db3	stripe	evt_3UNYkGRplmQkGUx50Dyp4fof	payment_intent.created	IGNORED	unsupported event type: payment_intent.created	2026-10-06 16:49:29.214+03	2026-10-06 16:49:29.217+03
4d885cd1-f85c-4e5b-8633-341f9b0d5f99	stripe	evt_3UNa5TRplmQkGUx50knCObj1	payment_intent.succeeded	PROCESSED	\N	2026-10-06 18:25:14.519+03	2026-10-06 18:25:14.538+03
\.


--
-- Data for Name: payments; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.payments (id, booking_id, amount, currency, status, provider, provider_reference, token, idempotency_key, paid_at, failed_at, created_at, updated_at, provider_status) FROM stdin;
b6a2508b-4ab6-4e86-a867-38a5f89a8066	b2252f0e-8138-4ce9-b74b-929cd818ee11	127.00	EUR	SUCCESS	mock	mock_seed_NVKLCSDW	\N	\N	2026-09-30 12:51:13.571+03	\N	2026-09-30 12:51:13.576+03	2026-09-30 12:51:13.576+03	\N
a06a2793-f5c8-4afe-8119-e0b12bb5964f	ab28ceb3-4cc4-4fef-8046-422df882e775	127.00	EUR	SUCCESS	mock	mockpay_642bfc03-d40f-4f6c-8070-11d34b7018a9	tok_e909752b5ded44049f853b3a409ffd08	642bfc03-d40f-4f6c-8070-11d34b7018a9	2026-09-30 22:17:27.935+03	\N	2026-09-30 22:17:27.936+03	2026-09-30 22:17:27.936+03	\N
64e6c1ee-3026-4c64-ab91-7dd1675ea11e	8a4fb707-cd06-4b81-858f-68c678d43a8d	2780.00	EUR	SUCCESS	mock	mockpay_efa52c39-4dca-40a4-8a7a-058f07a91cc6	tok_5d327972d9644678b192f19d7e9d1fb9	efa52c39-4dca-40a4-8a7a-058f07a91cc6	2026-10-05 19:16:38.102+03	\N	2026-10-05 19:16:38.103+03	2026-10-05 19:16:38.103+03	\N
4765e808-2048-4106-b22d-e5449213257e	e4efd9f8-c6c9-44a8-96b5-ca3e6cce8e45	408.00	EUR	PENDING	stripe	\N	\N	fe3efc22-2df1-45d3-a3a6-9ef091d5f1bb	\N	\N	2026-10-06 15:34:56.606+03	2026-10-06 15:34:56.606+03	\N
0e3bd9c8-c42a-4205-84d8-56ac6890c9b5	31f0228f-002b-4a71-9335-e5845c66538b	127.00	EUR	SUCCESS	mock	mockpay_492d60ed-4e31-4880-a103-dda8939e2dab	tok_b11770bc04584c2fa8016fa2fd3e6a87	492d60ed-4e31-4880-a103-dda8939e2dab	2026-10-06 02:02:40.646+03	\N	2026-10-06 02:02:40.646+03	2026-10-06 15:51:46.268+03	\N
280c98d3-6e52-4855-b992-86756d243424	00598b8b-835f-442a-a2f2-ad6d0bf3417f	408.00	EUR	PENDING	stripe	\N	\N	ca34c364-899f-434f-bf02-b9b7c278aac7	\N	\N	2026-10-06 15:58:41.938+03	2026-10-06 15:58:41.938+03	\N
9fc35475-9496-431a-b51c-1e7497165387	b80a3617-7cb0-4566-90cc-441ef0c6ab77	346.00	EUR	SUCCESS	stripe	pi_3UNYf8RplmQkGUx50vV7JACD	\N	e8c6601d-5ab1-46bb-beeb-bd469d28149a	2026-10-06 16:44:33.651+03	\N	2026-10-06 16:44:10.152+03	2026-10-06 16:44:33.652+03	succeeded
dacc6ba6-960d-4a82-8a16-66dd49ef1bc5	e0137147-5d75-4ece-a4a1-b445a857193e	346.00	EUR	FAILED	stripe	pi_3UNYgvRplmQkGUx518LFwqmi	\N	8f611911-8015-4a5b-9b1b-196d8e489e40	\N	2026-10-06 16:46:03.236+03	2026-10-06 16:46:00.763+03	2026-10-06 16:46:03.237+03	requires_payment_method
632db962-8067-4ad9-8cd7-dc7e4e81b5e8	b9146650-2237-4534-b220-2279ee9547d3	1769.00	EUR	SUCCESS	stripe	pi_3UQ5G7RplmQkGUx50MYMuesA	\N	9b95faf8-9489-4b74-8c0d-14f5f70ba518	2026-10-13 15:57:18.744+03	\N	2026-10-13 15:56:45.065+03	2026-10-13 15:57:18.746+03	succeeded
38dbc3d6-a54e-400d-a7c4-ead529ea78d0	8f0251b4-1af2-4397-a781-ac7f2b6ceedc	127.00	EUR	SUCCESS	stripe	pi_3UNrAZRplmQkGUx50dbjfSPH	\N	679c5f71-7242-4458-ba7b-ebd2202122de	2026-10-07 12:30:56.904+03	\N	2026-10-07 12:29:49.127+03	2026-10-07 12:30:56.905+03	succeeded
b9229034-c0e4-45b6-ac77-9ff635bb0464	56a92bc1-1398-4fb3-911c-f60891b143a3	127.00	EUR	PENDING	stripe	pi_3UNZooRplmQkGUx51YBJ1xGS	\N	50f42b04-e240-46e3-91bf-d1f08429a562	\N	\N	2026-10-06 17:58:14.333+03	2026-10-13 19:35:02.963+03	requires_payment_method
fe694828-21ff-494c-a3c5-d2b787b7dfae	e27218a4-ec6a-4801-84f1-3207b73af8aa	1428.00	EUR	SUCCESS	stripe	pi_3UPi0ERplmQkGUx514l9pYOl	\N	6c163b79-f0e7-4021-a706-6732997613da	2026-10-12 15:08:13.189+03	\N	2026-10-12 15:06:49.729+03	2026-10-12 15:08:13.19+03	succeeded
63b398ce-ecfb-4e54-8f35-a7cec9f3753a	e6f4fba4-c2c1-41eb-ac31-0fd41cd99b5b	346.00	EUR	SUCCESS	stripe	pi_3UNa5TRplmQkGUx50vqXk3NY	\N	b2292b5b-8f86-41bc-b85b-80f36948b3b8	2026-10-06 18:25:14.523+03	\N	2026-10-06 18:15:25.827+03	2026-10-06 18:25:14.525+03	succeeded
929ccd26-87ca-4270-8c20-1e1f4ee03945	b080bb80-af80-4f63-b70b-5963cea26f6c	505.00	EUR	SUCCESS	stripe	pi_3UNaJiRplmQkGUx50jJ9TlhY	\N	83b751c6-90ba-4f55-b0c6-4cbf4ce6aa7e	2026-10-06 18:32:44.511+03	\N	2026-10-06 18:30:09.727+03	2026-10-06 18:32:44.511+03	succeeded
1c58a475-2167-4deb-bf23-838aa8f16ba9	4236a14f-fe34-413a-b3e8-9d855720b6bb	127.00	EUR	SUCCESS	stripe	pi_3UOFTnRplmQkGUx513KSzkRO	\N	1a307ec5-125d-464c-b4b6-78c2c3390d7e	2026-10-08 14:28:41.557+03	\N	2026-10-08 14:23:51.771+03	2026-10-08 14:28:41.558+03	succeeded
74aa0b32-8f39-4ea1-8d12-783ed929913a	4226ef1a-2643-4ff4-9669-05fdbc7c3157	127.00	EUR	REFUNDED	stripe	pi_3UNfBvRplmQkGUx51d9z4g7R	\N	a7c1c33e-4149-4eeb-9503-ca0345eb8ad3	2026-10-06 23:43:38.469+03	\N	2026-10-06 23:42:26.036+03	2026-10-06 23:46:12.91+03	succeeded
a9cdaf14-04f3-47f7-9c06-558c9d790309	aa78e754-4d26-4759-891f-81febda53c2c	127.00	EUR	PENDING	stripe	pi_3UNYSyRplmQkGUx51xyJs9Pp	\N	a8b4806b-bd2d-4045-b01b-82eda156e830	\N	\N	2026-10-06 16:31:36.57+03	2026-10-13 19:35:00.529+03	requires_payment_method
6ce64e5f-17f4-4bff-a8d1-9e21e264e5ce	ec52f2d5-f1cc-4707-8a00-32cc1b503a69	505.00	EUR	SUCCESS	stripe	pi_3UNtghRplmQkGUx508z8FBor	\N	683739c5-8d25-4b53-8eb6-be8c82b6f460	2026-10-07 15:12:48.24+03	\N	2026-10-07 15:11:09.521+03	2026-10-07 15:12:48.241+03	succeeded
f26fb2a2-c867-4786-b98c-58b0fd043258	6a18720e-6788-4b8f-b236-3cae380f8143	1547.90	EUR	SUCCESS	stripe	pi_3UPUHGRplmQkGUx506CJGFHX	\N	1e2ae25d-0eb2-4693-baef-ee8334668bc0	2026-10-12 00:28:24.922+03	\N	2026-10-12 00:27:31.042+03	2026-10-12 00:28:24.925+03	succeeded
e95cc36d-401d-47a5-a2c2-5a88349683d4	802d1dac-67ac-44d9-a153-a5b6036fc90f	1547.90	EUR	REFUNDED	stripe	pi_3UOFvLRplmQkGUx51md6EALT	\N	1f201119-ca87-465f-9b4c-84b2b536d584	2026-10-08 14:56:31.404+03	\N	2026-10-08 14:55:46.385+03	2026-10-08 14:58:31.562+03	succeeded
319253f8-be55-47b0-8125-1e3d8f8dc4e9	e0137147-5d75-4ece-a4a1-b445a857193e	346.00	EUR	PENDING	stripe	pi_3UNYhPRplmQkGUx50egfFMzd	\N	8d525706-d410-4746-9b85-e818153c6f18	\N	\N	2026-10-06 16:46:30.892+03	2026-10-13 19:35:00.79+03	requires_payment_method
30ac02c1-2afc-4fdd-b902-b6c5befa8f64	1c01d63f-133c-4aa4-8644-83787c65601d	116.40	EUR	SUCCESS	stripe	pi_3UPf5TRplmQkGUx510x1HO8B	\N	47304007-a620-49f5-95b5-d72695663bb0	2026-10-12 12:05:18.74+03	\N	2026-10-12 12:00:03.167+03	2026-10-12 12:05:18.741+03	succeeded
ef3ad2c6-d2e1-49f5-a134-e02166afc5b9	108319d0-5696-4498-9c66-d05e5b1b2f99	2780.00	EUR	REFUNDED	stripe	pi_3UOIRnRplmQkGUx50oepBedb	\N	29012bbd-0139-4b5b-be1e-5da698e92dad	2026-10-08 17:38:03.253+03	\N	2026-10-08 17:37:25.783+03	2026-10-08 17:39:59.622+03	succeeded
87a38b88-cf77-491c-81bf-c12895e99361	3401d257-c7fd-4416-a482-9b5de1efaf34	1309.00	EUR	REFUNDED	stripe	pi_3UQ8O7RplmQkGUx51sSIqtyR	\N	6a232f71-f858-4f02-9868-b04c3478061f	2026-10-13 19:17:47.841+03	\N	2026-10-13 19:17:15.676+03	2026-10-13 19:20:05.237+03	succeeded
ffaf768b-76c3-4d9d-be60-d43513ce027c	81c4405c-835d-4005-bb06-38a7f7efb2a6	1428.00	EUR	SUCCESS	stripe	pi_3UQ6kQRplmQkGUx50iqh3kCY	\N	8bc91ae8-b2b8-4116-a10c-7a0a59e77462	2026-10-13 17:32:44.522+03	\N	2026-10-13 17:32:10.559+03	2026-10-13 17:32:44.524+03	succeeded
244d945e-6d3b-46bb-a9f7-acf2bfcfccb8	2dd1ce15-a14f-46b5-b47f-a29f17fc4028	346.00	EUR	PENDING	stripe	pi_3UNYhsRplmQkGUx50UTVpY0t	\N	0460b865-798e-4d79-b8af-371ad30ebd98	\N	\N	2026-10-06 16:47:00.404+03	2026-10-13 19:35:01.038+03	requires_action
42f1b64c-4537-4a4b-8611-eaeaa52f9d5b	59a7ed52-c362-44f1-b545-292fee0bf836	1428.00	EUR	PENDING	stripe	pi_3UNZQQRplmQkGUx51vzdVvYe	\N	cc99ac5c-ad91-4bb0-a859-b15a5c3fb357	\N	\N	2026-10-06 17:33:00.279+03	2026-10-13 19:35:01.481+03	requires_payment_method
9105a86f-88ea-43a3-aa19-11905761de0e	56a6a3e3-36d1-460a-bae7-1acaa3327684	346.00	EUR	PENDING	stripe	pi_3UNYkGRplmQkGUx50Q3mnDRQ	\N	9ce788e6-997d-4bb1-bbf4-027c41faf9d4	\N	\N	2026-10-06 16:49:28.548+03	2026-10-13 19:35:02.203+03	requires_payment_method
8f1086a6-f5bc-4f7a-b5d3-081e4ffc2fd3	ed6701ed-813e-4027-a3e1-0a01d3d911e3	346.00	EUR	PENDING	stripe	pi_3UNZleRplmQkGUx50ohWry7z	\N	8675d5c0-c15e-44e7-b40e-f43d13dc2c68	\N	\N	2026-10-06 17:54:58.112+03	2026-10-13 19:35:02.576+03	requires_payment_method
\.


--
-- Data for Name: permissions; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.permissions (id, resource, action, description) FROM stdin;
3d9cc0e0-e1a1-4bcf-9063-fbeb6529ff7b	users	read	View user accounts
55c79341-375a-416f-9199-89932ed9e7a7	users	create	Create user accounts
5b296d75-9ff2-4157-8125-d29806010f07	users	update	Update user accounts
81e34ed5-eb22-45bd-a3ac-3acd347bd3de	users	delete	Deactivate user accounts
1f8876e6-18d6-4f5a-ab82-5c033a77ab29	staff	manage	Manage staff accounts
0929494a-9252-4114-824f-2db8d9cac994	roles	manage	Manage roles and permissions
7be1d752-85fb-4847-bc89-cce76a4bb7cc	flights	read	View flights
fc1b04cc-2db2-4469-bb00-77c475dc320f	flights	manage	Create/update flights
f6fce2a0-b767-48f8-a7e3-9b33abbba53a	airports	manage	Manage airports
12883033-8fd3-4fc2-b0c1-7688d4a1e113	aircraft	manage	Manage aircraft
a817eba6-8adf-4b50-8684-50e47e486cd2	routes	manage	Manage routes
97415b68-405f-4b18-945e-fb803cb35c3b	bookings	read	View bookings
5f99eadb-1489-48e1-8399-fb78e0e617b1	bookings	manage	Manage bookings
92c1b575-e93f-4afe-a24d-82dc204dc186	payments	read	View payments
3a482e60-bd35-4b48-bd65-2b2ddbd413fe	payments	refund	Process refunds
94ab4535-70d6-485e-b266-83072661d89f	baggage	manage	Manage baggage records
91eb19db-0c0b-44ca-9818-7215046b552d	checkin	manage	Manage check-in and boarding
b4993d76-4a1f-473f-bd3d-4d360abed570	loyalty	manage	Manage loyalty accounts
93ea14f6-ae2a-4019-bd6c-c2419793ad9d	notifications	manage	Manage notifications
681a2b22-b85c-4ab3-a1ea-995b87490026	reports	read	View and export reports
7f974748-4c5d-4e59-8ac1-93b03a70c531	audit	read	View audit logs
33ac0729-1dee-4838-badd-966bc1852bbc	dashboard	read	View operations dashboard
27f3c442-a0d7-4fd6-8e1a-731f9d495c6c	settings	manage	Manage system settings
a9d73b4a-30f7-424a-bbf1-31a94d8f6b82	offers	read	View offer catalog
59ba6aad-9393-4924-be30-2699737d18e9	offers	manage	Manage offers
\.


--
-- Data for Name: refresh_tokens; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.refresh_tokens (id, session_id, token_hash, expires_at, created_at, rotated_at, replaced_by_id) FROM stdin;
ba5b6b14-4124-482c-9a89-4fb0e990e636	b923b015-5591-448f-a378-eeed3e99b0ea	e7428a63f93a83c46bf88e7c80d462399ba843a768f0f567015e98f5fd34f967	2026-10-07 11:58:48.522+03	2026-09-30 11:58:48.525+03	\N	\N
ca95c0e5-3ea3-4beb-8a26-8d451e02c44f	7d87191a-007b-4164-832d-378feab3833d	b0fa869d8d066c5a59481ada83600236fb9db25e83f69c35e8a01c187bb52eba	2026-10-07 12:19:18.816+03	2026-09-30 12:19:18.817+03	\N	\N
710a3902-a483-4dd3-beb6-294ffb259af5	305dedb8-5a5b-411e-bd3b-0f271efc530f	dc69b3028aa3cdc5aa7ff38ae4fd2e17bef6b260c54a83da3dc056f258b83e88	2026-10-07 12:19:58.648+03	2026-09-30 12:19:58.648+03	\N	\N
7fea5626-b5f5-42ce-bfe2-eac25b59cd24	c478e950-f69b-4a1d-8e8e-d918e66d5048	383f89467f3629d7c00b71757cc194939d3dd4dd9de4ef4ee04822da245bbeb6	2026-10-07 12:49:10.056+03	2026-09-30 12:49:10.057+03	\N	\N
066b7e62-f37c-4ecf-a943-4a50ccef1e8d	02287488-01c4-4867-98b8-cf8147328de1	ce5701a6924bbfd561b570985f5e28af0db97811bf65820edaa18fcebcef590f	2026-10-07 12:52:47.565+03	2026-09-30 12:52:47.567+03	\N	\N
6a986318-f1a0-4caa-a87a-cf41e607d52e	02287488-01c4-4867-98b8-cf8147328de1	e5d5d75bce3829a44bae3f7da666577f839d941b7c717e1b2ef9703b94c3169b	2026-10-07 12:52:30.214+03	2026-09-30 12:52:30.215+03	2026-09-30 12:52:47.565+03	066b7e62-f37c-4ecf-a943-4a50ccef1e8d
e9882a42-449a-4b7e-9d48-c340edaab4d8	15ccf45a-ab8a-43ad-9f66-bed288a233c6	ba109d90de52b622ff06dd654fd3231b42275bcff1634de70c4da109a45cfc30	2026-10-07 12:52:56.103+03	2026-09-30 12:52:56.103+03	\N	\N
d602af14-dcba-45da-9563-2418e5a83ff3	90f7c85e-d8f2-48e3-9203-343dc50d0389	b0b47b7b99492c3b56fa75fce08c8da391a406b5bfbb1425497f126fd7b95db8	2026-10-07 12:54:50.097+03	2026-09-30 12:54:50.098+03	\N	\N
264b2e0a-91be-4b63-9671-577c61f7af16	8f404678-b8dd-4562-8f92-46c0920b8b60	1b1b5b7b666da27ad679d1b00dc8b916fd19787bc09d7c57fd2d36e1c4b61b8e	2026-10-07 22:12:05.568+03	2026-09-30 22:12:05.569+03	2026-09-30 22:15:38.379+03	9a6385a8-63ca-4da3-b456-3be9b68e8afc
9a6385a8-63ca-4da3-b456-3be9b68e8afc	8f404678-b8dd-4562-8f92-46c0920b8b60	5b81667cd851fe760229b4c1dbfc263c94bc836266686e4c7c1eee74cc4d7d4f	2026-10-07 22:15:38.379+03	2026-09-30 22:15:38.38+03	2026-09-30 22:15:41.534+03	70ab37bc-ae45-4b9f-b32a-d692f476f0f8
d38a1f54-c562-4300-939b-e0798b3aa15e	714cd936-ac96-4585-8d69-732ec72f232d	3abe55d725a910d80658ee16c2882bcfbdcc2b04e36670dd514427dc6648ee3c	2026-10-07 22:16:34.76+03	2026-09-30 22:16:34.76+03	2026-09-30 22:16:58.541+03	69a6b556-e146-4de1-a039-b86d61c61d7b
32ff5a08-e685-417c-8a4c-0c91888cc460	714cd936-ac96-4585-8d69-732ec72f232d	91656fdda040afcdd1dc6719ba88df21a96104eec276cf6199b888d657f9dedc	2026-10-07 22:17:33.135+03	2026-09-30 22:17:33.137+03	\N	\N
69a6b556-e146-4de1-a039-b86d61c61d7b	714cd936-ac96-4585-8d69-732ec72f232d	c86ab55d2a6548f89137fdfa49758071837b827326074d41c69d7214e84a02b9	2026-10-07 22:16:58.541+03	2026-09-30 22:16:58.543+03	2026-09-30 22:17:33.135+03	32ff5a08-e685-417c-8a4c-0c91888cc460
70ab37bc-ae45-4b9f-b32a-d692f476f0f8	8f404678-b8dd-4562-8f92-46c0920b8b60	eec6836a6acf40fadef888ef652576242ab5b86e6fc749d3e199a01b853c307e	2026-10-07 22:15:41.534+03	2026-09-30 22:15:41.535+03	2026-09-30 22:18:17.754+03	e3427d80-4e4d-4279-957b-7fb33994e4c3
e3427d80-4e4d-4279-957b-7fb33994e4c3	8f404678-b8dd-4562-8f92-46c0920b8b60	ea9ffcaad383c1374c6e1b5c813f51ece50ad53d56d616bc55b3e4ddc04ef2fb	2026-10-07 22:18:17.754+03	2026-09-30 22:18:17.755+03	2026-09-30 22:19:45.164+03	79a4f3bf-1d2c-4c3f-b53b-3424dd0fb728
e80fb0d9-589f-4ed6-bdb1-aab2dee6f430	8f404678-b8dd-4562-8f92-46c0920b8b60	6f8e08b62b4e0ebfc08b99b51ae56ca50037f6e17210f54374c24dc30a9c460e	2026-10-08 16:14:01.422+03	2026-10-01 16:14:01.448+03	\N	\N
79a4f3bf-1d2c-4c3f-b53b-3424dd0fb728	8f404678-b8dd-4562-8f92-46c0920b8b60	7f0eec4d08ac8307b3424af83dff6f2b0a48ef06ca096f3444dc1303913029e5	2026-10-07 22:19:45.164+03	2026-09-30 22:19:45.165+03	2026-10-01 16:14:01.421+03	e80fb0d9-589f-4ed6-bdb1-aab2dee6f430
39472acb-1ca6-4e12-8afa-ddac13a2d1f9	596e8fe1-f91e-45a0-9ff6-4eb7e3391d7a	02759964926fd970cc2fe8d14a5435dae1440a25f1f83ba65a2944b00e54182c	2026-10-08 16:16:39.853+03	2026-10-01 16:16:39.854+03	2026-10-02 15:17:00.028+03	dbf9a01b-b583-4d04-8413-c4dd38443fde
dbf9a01b-b583-4d04-8413-c4dd38443fde	596e8fe1-f91e-45a0-9ff6-4eb7e3391d7a	faf845ae8c5cb831d276579b6b92ac089031b888e26e5151196f5625c63fa738	2026-10-09 15:17:00.028+03	2026-10-02 15:17:00.079+03	2026-10-02 15:21:38.53+03	650710b2-ad9d-41c5-95e2-d33d159bfe7b
650710b2-ad9d-41c5-95e2-d33d159bfe7b	596e8fe1-f91e-45a0-9ff6-4eb7e3391d7a	99fe81c6d5c67840a0193a2f2d8e2df36b2df0a772054940e5cab68e4dfb89c5	2026-10-09 15:21:38.53+03	2026-10-02 15:21:38.531+03	2026-10-05 14:51:26.615+03	ee6e3ec3-0e69-4e51-9341-e4b9956fd629
ee6e3ec3-0e69-4e51-9341-e4b9956fd629	596e8fe1-f91e-45a0-9ff6-4eb7e3391d7a	55c6098c751885bf305061d860ba5ff1796ff181e4915bcb673109d89e48f64e	2026-10-12 14:51:26.615+03	2026-10-05 14:51:26.623+03	2026-10-05 14:51:50.212+03	7df39ac7-898e-4f22-bc90-ea1e86ae1dd2
7df39ac7-898e-4f22-bc90-ea1e86ae1dd2	596e8fe1-f91e-45a0-9ff6-4eb7e3391d7a	2a8cd71994464f85d15887a8582ebd5b3108a722b9aff7d72f635807b42f6560	2026-10-12 14:51:50.213+03	2026-10-05 14:51:50.215+03	2026-10-05 14:51:51.167+03	6e87f376-5054-4f2a-aeb7-fcf3f8bff925
6e87f376-5054-4f2a-aeb7-fcf3f8bff925	596e8fe1-f91e-45a0-9ff6-4eb7e3391d7a	3938c834ce335bbea7b179ad0cca697a1a181419431bad36d39195deaafb0299	2026-10-12 14:51:51.167+03	2026-10-05 14:51:51.169+03	2026-10-05 14:54:52.831+03	9be3aacd-61a4-47d4-b97e-e3d6543d2854
8cab041f-05dd-4f08-abd4-48c7f21b0768	596e8fe1-f91e-45a0-9ff6-4eb7e3391d7a	25bd5794ce9af842f39c2c4d26cdc7f920a829ebf08455b3c3b5dc0a213bb5b2	2026-10-12 15:10:23.633+03	2026-10-05 15:10:23.634+03	\N	\N
9be3aacd-61a4-47d4-b97e-e3d6543d2854	596e8fe1-f91e-45a0-9ff6-4eb7e3391d7a	173126dcf39484c67c28ce8d853a9638ace6a7b32311e8aa6f6f5d88fce29307	2026-10-12 14:54:52.831+03	2026-10-05 14:54:52.834+03	2026-10-05 15:10:23.633+03	8cab041f-05dd-4f08-abd4-48c7f21b0768
7b2d9f55-389b-44c0-86b3-08176e20a183	6f81a2f0-84e6-47b0-b79a-900a993a32ca	fb1366e97b3ebc8e5a3863249b001c5509f2898c8a38603485f36423c3d3b4e5	2026-10-12 15:10:43.939+03	2026-10-05 15:10:43.94+03	2026-10-05 15:11:34.65+03	0bd4219d-1aae-48fd-a67a-5db9dfff11cd
0bd4219d-1aae-48fd-a67a-5db9dfff11cd	6f81a2f0-84e6-47b0-b79a-900a993a32ca	b53a456a7f8843cd2b87a97f8acebef5cee61080f761c4eba2c9fb1bacf6d53c	2026-10-12 15:11:34.65+03	2026-10-05 15:11:34.652+03	2026-10-05 15:13:12.262+03	5c5e11d7-bbbd-4435-8542-68a8f7cda3e1
5c5e11d7-bbbd-4435-8542-68a8f7cda3e1	6f81a2f0-84e6-47b0-b79a-900a993a32ca	17b75dfddad16b51ae68e96ef7dcb398662feb69d9f2bd350144982bcd1c8dd0	2026-10-12 15:13:12.262+03	2026-10-05 15:13:12.264+03	2026-10-05 15:44:51.587+03	613e55ac-6638-4d8a-bed9-262cc52089e9
5881bcc7-21d8-4949-9604-8f8630dd951f	6f81a2f0-84e6-47b0-b79a-900a993a32ca	2e092071fd2b9b21cc588c4b9c537d848a451eefa57be02820ec3c6d26ec2b9c	2026-10-12 16:02:34.019+03	2026-10-05 16:02:34.021+03	\N	\N
613e55ac-6638-4d8a-bed9-262cc52089e9	6f81a2f0-84e6-47b0-b79a-900a993a32ca	f1e6e9cc6e89f9a262370b0c5610da6d700d875e3fce9ca6758cda76d0097c69	2026-10-12 15:44:51.587+03	2026-10-05 15:44:51.59+03	2026-10-05 16:02:34.019+03	5881bcc7-21d8-4949-9604-8f8630dd951f
f74e9cf6-bab0-499c-9938-60334a9ebc1e	df501df1-473f-4aa9-90f3-42fcb269898c	5650c5546f5ce8efbf99f4acd25d13f4f049ad8b4c55bca709ef8e85f36b8ce4	2026-10-12 16:07:27.563+03	2026-10-05 16:07:27.564+03	2026-10-05 18:02:36.202+03	8fa2cef1-a532-4bde-94a2-1f4fb3af1feb
8fa2cef1-a532-4bde-94a2-1f4fb3af1feb	df501df1-473f-4aa9-90f3-42fcb269898c	d0f43ea167196497c36d0d4976d86ccc67c7c2b0059ded7235b65641462eea36	2026-10-12 18:02:36.202+03	2026-10-05 18:02:36.204+03	2026-10-05 18:02:41.732+03	ff38a907-a093-4028-8d7b-00d79a1bcb86
99dd0180-3135-4782-9f04-28e9939ac80c	df501df1-473f-4aa9-90f3-42fcb269898c	093c9f21f314de7acc57869aeadf938aa430ed522fb24188d785adbcdb2ae20b	2026-10-12 18:02:44.666+03	2026-10-05 18:02:44.668+03	\N	\N
ff38a907-a093-4028-8d7b-00d79a1bcb86	df501df1-473f-4aa9-90f3-42fcb269898c	214e2d08b04f23c7730c6ed21d908bcd2a40fc308e7107bec96fc59a75028d4e	2026-10-12 18:02:41.732+03	2026-10-05 18:02:41.735+03	2026-10-05 18:02:44.666+03	99dd0180-3135-4782-9f04-28e9939ac80c
481888ac-c1e3-4b45-883e-4896c7f3cd19	c87a364b-8839-45b3-a3d3-ae4fd08c417d	b77151f553317529b4e60fa0529e35995f90d5b9670f82a76cccd7b563e61856	2026-10-12 18:03:22.464+03	2026-10-05 18:03:22.466+03	\N	\N
eab5a10c-40cb-452f-ac3e-3f52d6fb19f4	c87a364b-8839-45b3-a3d3-ae4fd08c417d	94b8196b5115ca277c72f1d0cd1fbc24b58c3973895febb81c8e3d99cac84df3	2026-10-12 18:03:15.944+03	2026-10-05 18:03:15.945+03	2026-10-05 18:03:22.464+03	481888ac-c1e3-4b45-883e-4896c7f3cd19
8361830a-94e7-4ad4-96fd-8bbdc33bf24a	39597aba-f006-4143-b674-d749d9147a99	da0ce07259e1ed3f042d21d50dc3fba1f9ebefc097311c47b77344147bab4f13	2026-10-12 18:03:41.146+03	2026-10-05 18:03:41.147+03	\N	\N
64b125b9-43f6-494a-b0ec-9873a8b238dc	197173e9-fac5-4815-91b8-71bf752564d3	f95dec46acad81cdd6bf77fd7f4ef4f2dfbd1b681ca99fd0af1f7f6819c3096c	2026-10-12 18:03:43.848+03	2026-10-05 18:03:43.849+03	2026-10-05 18:19:03.092+03	e68d2802-9eb0-4643-885d-c80544932124
f6c73fa4-cf87-4a3c-a77e-d6a950cbba96	197173e9-fac5-4815-91b8-71bf752564d3	4ed8cbbe388e6e9d816dab9cd28548c6181d2f7397e60d564a9b5f66f3c9ea12	2026-10-12 18:19:13.683+03	2026-10-05 18:19:13.685+03	\N	\N
e68d2802-9eb0-4643-885d-c80544932124	197173e9-fac5-4815-91b8-71bf752564d3	2e09e53a0babe7053f80dc18461012325ba1e6acba21392e46dba86c1bc61dd7	2026-10-12 18:19:03.092+03	2026-10-05 18:19:03.093+03	2026-10-05 18:19:13.683+03	f6c73fa4-cf87-4a3c-a77e-d6a950cbba96
c109a664-18a4-4e4d-bf7d-ad9876a1f15e	23ad2653-6f2b-49f8-acc9-1a0f0c5af0ce	82caf78da7d80bd621c4770eadaabb9410f843082500666b72cdc26a114b9b0c	2026-10-12 18:27:14.326+03	2026-10-05 18:27:14.328+03	\N	\N
4c90bdd6-df50-4562-a03e-1babcd8863c1	23ad2653-6f2b-49f8-acc9-1a0f0c5af0ce	7252531853cd9f173a06b5fee41d62f40904b903ca2cf487a330ba7cfbfabe4a	2026-10-12 18:25:47.854+03	2026-10-05 18:25:47.854+03	2026-10-05 18:27:14.326+03	c109a664-18a4-4e4d-bf7d-ad9876a1f15e
ef92b055-f853-46a0-918b-b7b033cdb204	5ed9f33f-5d59-4a2a-9b5d-b801c1d45d18	c3aeb4a4c5d2ed8e45d19d754040b6ddf15ca33da20957a3b1d2b7da1998f36a	2026-10-12 18:27:35.98+03	2026-10-05 18:27:35.981+03	2026-10-05 18:30:01.814+03	43748ce0-92eb-4f26-84af-8e83e7cbda2e
43748ce0-92eb-4f26-84af-8e83e7cbda2e	5ed9f33f-5d59-4a2a-9b5d-b801c1d45d18	b6bd3075deb98a6f24a240ced313de619b5bad8891e158488b970261d15fc92c	2026-10-12 18:30:01.814+03	2026-10-05 18:30:01.816+03	2026-10-05 18:30:06.935+03	b8f99b16-7d0f-470a-b41e-da1e15d7d3cc
b8f99b16-7d0f-470a-b41e-da1e15d7d3cc	5ed9f33f-5d59-4a2a-9b5d-b801c1d45d18	655f9307b0c1406912c3f22f790f2fc284014b9bcbcb1da532a8dd1944a2bbc2	2026-10-12 18:30:06.935+03	2026-10-05 18:30:06.937+03	2026-10-05 18:30:37.974+03	c9ff4deb-da82-4db9-94e0-4b22c57a96c5
c9ff4deb-da82-4db9-94e0-4b22c57a96c5	5ed9f33f-5d59-4a2a-9b5d-b801c1d45d18	359c38bb42349c595bb216abe37b9d3aef1bc88a2ce483fc4b4e87fa83ef36a2	2026-10-12 18:30:37.974+03	2026-10-05 18:30:37.976+03	2026-10-05 18:30:38.839+03	bf860222-7373-41f5-bce3-d4dc59270c85
bf860222-7373-41f5-bce3-d4dc59270c85	5ed9f33f-5d59-4a2a-9b5d-b801c1d45d18	20788bef9cc1a1ea64b263fdbad1e09391bfdb729302c7ba14a7dd68329c2312	2026-10-12 18:30:38.84+03	2026-10-05 18:30:38.841+03	2026-10-05 18:41:40.954+03	222826bc-ca0e-428e-a386-ebb0553f22ba
aca23667-be40-4401-bb8d-b0e24e3860c8	5ed9f33f-5d59-4a2a-9b5d-b801c1d45d18	58490a920f51e04d16f5228c27ea8fa707f03452e3bd7afb78109be60b39237a	2026-10-12 19:00:23.969+03	2026-10-05 19:00:23.976+03	2026-10-05 19:14:29.322+03	b2ad8ea9-7760-42ca-b0cc-99b26664eb55
222826bc-ca0e-428e-a386-ebb0553f22ba	5ed9f33f-5d59-4a2a-9b5d-b801c1d45d18	c65b453bf1472793b658c8665c1b4b89d8dbb8883febf4e22fea2bd2558d487a	2026-10-12 18:41:40.954+03	2026-10-05 18:41:40.955+03	2026-10-05 19:00:23.969+03	aca23667-be40-4401-bb8d-b0e24e3860c8
b2ad8ea9-7760-42ca-b0cc-99b26664eb55	5ed9f33f-5d59-4a2a-9b5d-b801c1d45d18	6f810fd9ef15cc546eb76c180d883a8d3fc7ca4a215f7a800e4deb71592ccf47	2026-10-12 19:14:29.322+03	2026-10-05 19:14:29.328+03	\N	\N
1b926d74-4a70-4e5d-a6bd-4056c67f5dfe	8a1a1b9c-b655-4c1d-8af3-635f41c87e69	3f2ac436c7218fcc801c4c599a1008b869ae18f2d2a60c2247280fd73616e182	2026-10-12 19:14:51.179+03	2026-10-05 19:14:51.183+03	\N	\N
007a03f9-69ff-4b53-b658-2a3c35cf7de1	00c39fcd-675f-4b75-805a-835cf0aabcb6	659a5536bbd2fe1e267e48355a034420cb033741c56795360fe2df9d4b4b9890	2026-10-12 19:18:13.985+03	2026-10-05 19:18:13.987+03	2026-10-06 02:00:04.229+03	b4bda132-5075-49e1-93bf-006e78401a06
5a170d1b-9084-4096-9260-4385bdcc4442	00c39fcd-675f-4b75-805a-835cf0aabcb6	cac99f8e14175d061bb7ed5c70ed24474b05834c0913c2619025ae68b385ef4c	2026-10-13 02:00:08.993+03	2026-10-06 02:00:08.994+03	\N	\N
b4bda132-5075-49e1-93bf-006e78401a06	00c39fcd-675f-4b75-805a-835cf0aabcb6	72c5d5d80bdbff347af8165743daed394245bb91593ddb3135907c05d1f080f5	2026-10-13 02:00:04.229+03	2026-10-06 02:00:04.231+03	2026-10-06 02:00:08.993+03	5a170d1b-9084-4096-9260-4385bdcc4442
2943b683-98bd-4289-81a1-616ffb6ea5ba	74db8183-72c7-4a5f-99dc-376296188d70	fd660dd6adba2d8b5698ab0a4ad0c17016264f03305733d7970f4fc314e20f65	2026-10-13 02:02:58.435+03	2026-10-06 02:02:58.437+03	\N	\N
e32abb76-2a96-41d9-aa99-758c5f4bff78	74db8183-72c7-4a5f-99dc-376296188d70	0a1897c35106cbfb64c18e63f02279f8d97b7bad6a297226458e72f51996e0d9	2026-10-13 02:01:03.848+03	2026-10-06 02:01:03.849+03	2026-10-06 02:02:58.435+03	2943b683-98bd-4289-81a1-616ffb6ea5ba
d2420446-369a-478b-b834-eaa05b32673b	67372d8a-33ab-49e1-87ae-490c9aa49394	6f73087e070248a1ba26ca1065a2dad58792cb3a3125a7ac22003dc2bee590fa	2026-10-13 02:03:22.616+03	2026-10-06 02:03:22.617+03	\N	\N
cb21006a-ea83-414b-8641-254f3de30769	cf1e1081-5126-423a-8553-6ea2956affdf	59df8fc53c6611052838efdea15553dbada39c09522e23c8f7a025b2b20f2e86	2026-10-13 12:58:01.949+03	2026-10-06 12:58:01.951+03	\N	\N
3ffd33bb-539c-4e93-ac8e-bd51e51b2a95	cf1e1081-5126-423a-8553-6ea2956affdf	2d95745888fd9dab5352a4dc1a6c249a9d3785eeeca165a31a5e437ad8e43859	2026-10-13 02:04:57.187+03	2026-10-06 02:04:57.188+03	2026-10-06 12:58:01.949+03	cb21006a-ea83-414b-8641-254f3de30769
551b93d0-917e-46df-abe3-7477749f5806	fb856980-4416-4229-b82e-bf45fa83f126	3b5b4849b0e307b296cbd5c2c0f912c4800d8f2aee23c2ba2e9dad07c99f8afb	2026-10-13 12:58:27.529+03	2026-10-06 12:58:27.53+03	\N	\N
cca581dd-21f3-4369-a1c4-f3d04457a651	3bb340ae-1cb2-4680-b9de-9264db1e3c26	5367ed7e98e9b1e5ce0ce3e24faa0845be8d5b9d257a4c265503821f3fd57bd3	2026-10-13 13:01:27.876+03	2026-10-06 13:01:27.878+03	\N	\N
a7bb59a5-1c58-48b7-8b3c-d040c9f59a20	3bb340ae-1cb2-4680-b9de-9264db1e3c26	1b4c1169812918dd89542395ab4d064f06f06ade493e7276b2bbf680bbb9603c	2026-10-13 13:00:07.365+03	2026-10-06 13:00:07.367+03	2026-10-06 13:01:27.876+03	cca581dd-21f3-4369-a1c4-f3d04457a651
081fa7ab-9d7c-4c6f-b1af-4717276c5056	fa37f552-0917-4852-b8ae-049efa0103c8	3c57500b1059f04ce42bf8438b91420c3ff83f70e2647e04249f6e9ffa9d8a56	2026-10-13 14:15:22.599+03	2026-10-06 14:15:22.603+03	\N	\N
b8773313-0f5c-43b1-bce9-3c6f27818cc0	3ba08ae7-eab3-40c5-83bb-52c074964cab	d2b4796611437317f8bb16a1f92ac6e587a321ad20ebe633da5535b427d28b60	2026-10-13 14:15:55.291+03	2026-10-06 14:15:55.294+03	\N	\N
69a30b44-44e8-485d-85bc-a7b96790fc26	d672ad58-137f-4bdc-a234-8897ca28a8f0	9bf0ed3dd5eaccf18b6f31792f15e43106f88a274be3853e46c2eeb4adda9e92	2026-10-13 14:16:02.539+03	2026-10-06 14:16:02.542+03	2026-10-06 15:32:30.979+03	1d69dad0-f649-4155-83dc-7adbba87cfcb
1d69dad0-f649-4155-83dc-7adbba87cfcb	d672ad58-137f-4bdc-a234-8897ca28a8f0	27ebb282499fe4a50a62363a8b3dbaf27abc680f668cdf4c26d4704c7bcf571e	2026-10-13 15:32:30.979+03	2026-10-06 15:32:30.981+03	2026-10-06 15:32:34.966+03	59b250f0-4cbb-46f3-998f-ba1ef477a892
59b250f0-4cbb-46f3-998f-ba1ef477a892	d672ad58-137f-4bdc-a234-8897ca28a8f0	d0709fd9dbfb151ad93fa4a58b7962aab5f2eab315461ebe11aa18d32150dbe3	2026-10-13 15:32:34.966+03	2026-10-06 15:32:34.968+03	2026-10-06 15:33:23.222+03	49cd8987-14f6-437d-af21-bc40b5baddf6
49cd8987-14f6-437d-af21-bc40b5baddf6	d672ad58-137f-4bdc-a234-8897ca28a8f0	c28456aeec0b210ce9ea5e47edd556ddb985ca8849be865d827e0c2ee359d143	2026-10-13 15:33:23.222+03	2026-10-06 15:33:23.224+03	2026-10-06 15:33:27.602+03	54397a70-9d17-42f4-9988-b8282bd5001f
3d4e0115-5de5-4980-9437-9a60ebe1b996	d672ad58-137f-4bdc-a234-8897ca28a8f0	1b74bcbb4f22facc7da7a4982dc97dc3d5aeaa85879604ca38f59792fcb2a717	2026-10-13 15:33:31.418+03	2026-10-06 15:33:31.42+03	\N	\N
54397a70-9d17-42f4-9988-b8282bd5001f	d672ad58-137f-4bdc-a234-8897ca28a8f0	6a046c43cfaa40c7e385c773ff7570a13c532a36a2e947e1e80b8650fc5acdee	2026-10-13 15:33:27.602+03	2026-10-06 15:33:27.603+03	2026-10-06 15:33:31.418+03	3d4e0115-5de5-4980-9437-9a60ebe1b996
88680be7-1c91-4b8c-bb4e-4ca9ecac84ae	1df797a0-59fc-4d4b-8601-05b21cca4825	88d2feae32adeee218b368cbc08a181d832b91fc815851ab130205ed038e17e2	2026-10-13 15:33:56.854+03	2026-10-06 15:33:56.856+03	\N	\N
da90de69-0aed-4c9d-aecd-8327ed99237e	1df797a0-59fc-4d4b-8601-05b21cca4825	b39d3d2a9fc1a80e9afe007834f02c767fabbcc12436aa2c2f57ba61f3e00cf1	2026-10-13 15:33:49.935+03	2026-10-06 15:33:49.936+03	2026-10-06 15:33:56.854+03	88680be7-1c91-4b8c-bb4e-4ca9ecac84ae
138269d4-1875-4c84-95bf-343de081a34b	5507ffcb-ab03-48ac-9c26-56591530ee78	5e6ad9bfea835c3af02fb97ec50427934c3fffba1f53dfbe5278bcd207b0403f	2026-10-13 15:49:56.582+03	2026-10-06 15:49:56.583+03	\N	\N
fc6a3c3c-c05f-4ff9-8a3a-ffafe251b81c	5507ffcb-ab03-48ac-9c26-56591530ee78	8527d9adeefbdce38ffaacb9f3b92e79292007bf219174758e127a83059c8a22	2026-10-13 15:34:08.886+03	2026-10-06 15:34:08.887+03	2026-10-06 15:49:56.582+03	138269d4-1875-4c84-95bf-343de081a34b
5477d552-c1c5-4ae9-98ed-b8d63dc4bfa3	db2ceda1-0d5d-4fd1-adb7-e75f8cfb479d	2f35c314a49875fa1857fd5d22a125d06c8df3ed3b6245e2778ab266c9fc42e3	2026-10-13 15:50:48.603+03	2026-10-06 15:50:48.604+03	\N	\N
9eff74b0-bdf2-4c66-a3b2-91b330e3b4cc	0a0f3c46-3b6e-44e9-879a-ee9064dd7451	03227aa8a4316c03f8d8bd8ea714132f09fa47b35d936c18118d70477e0046da	2026-10-13 16:01:14.641+03	2026-10-06 16:01:14.643+03	\N	\N
23dec990-00ad-4550-a5de-d72e6102d297	0a0f3c46-3b6e-44e9-879a-ee9064dd7451	012fcd29b80fb9b613c094279dab35d8f4b8befedc1d724ae64855d733a36531	2026-10-13 15:57:27.945+03	2026-10-06 15:57:27.946+03	2026-10-06 16:01:14.641+03	9eff74b0-bdf2-4c66-a3b2-91b330e3b4cc
92a5a99a-ee1e-4715-a1c2-b2d32aaaa806	3eced300-1560-4427-80af-23841e125544	3ab6aaf350a3e9349b5104df4078a8d3b38bb5984f6a0161f233565f8f4b3ffa	2026-10-13 16:30:21.149+03	2026-10-06 16:30:21.151+03	\N	\N
cdfe839a-ba03-4ce4-a2dc-3801ad43a71b	3eced300-1560-4427-80af-23841e125544	ea35ac03cf22beb5f52df94e5d82e3ae3e985ec99122c6a1ee8439ea84e73c44	2026-10-13 16:07:56.97+03	2026-10-06 16:07:56.971+03	2026-10-06 16:30:21.149+03	92a5a99a-ee1e-4715-a1c2-b2d32aaaa806
c51aeb14-9f91-41e9-91b4-b170a576a5fd	028a86bc-a78d-454c-9c64-bd8a92cad93a	714ab3c89e1fef84b42fc1ed065d75e6a4cb0990d513e91c5bb45aa3c0a74f19	2026-10-13 16:32:09.586+03	2026-10-06 16:32:09.588+03	\N	\N
52ef3f14-8f41-4476-b4e2-c028ef46f588	028a86bc-a78d-454c-9c64-bd8a92cad93a	594f5d20368090d27fcd4da605f68a9171e69f1dc423458b25e79e3728f973f7	2026-10-13 16:30:42.456+03	2026-10-06 16:30:42.457+03	2026-10-06 16:32:09.586+03	c51aeb14-9f91-41e9-91b4-b170a576a5fd
e39e10da-6d98-410b-bcdf-7ee038ba7380	f2a2423b-8f33-495a-90d6-4e9af77da2b2	08636642ff09c872d64adcf2c92dbcc4e650fd642229daca0174643eec6576da	2026-10-13 16:32:32.189+03	2026-10-06 16:32:32.19+03	\N	\N
97f68391-ba24-4c44-a231-9a05d3305b53	6c2c3ff2-3d13-4da0-b5fa-513efb4ac201	f5ef0bea5f4ee0ededcc688a6ec39aebb73b25563e6cda514ee5ee0f28579a94	2026-10-13 16:43:37.083+03	2026-10-06 16:43:37.084+03	\N	\N
4cdac4c4-ba52-4a8c-88ee-e5870c13cb0d	90d30fb9-e775-4838-903c-beed53e2be9e	f212cdf5061b798cb0ab6b3d5e521178eceee5385c40d5112c2385232719237f	2026-10-13 16:43:48.68+03	2026-10-06 16:43:48.681+03	\N	\N
85802814-1419-471d-9fc4-0993fe835d26	e9db6f47-671d-4f13-9db0-bbbbafb0a0c6	402cbe7f15cca688b10fefd4e1b092befaf4cda2ff6adaab50b6ec99935bdd86	2026-10-13 16:34:46.389+03	2026-10-06 16:34:46.39+03	2026-10-06 16:50:30.37+03	3ac2f699-de78-46f3-b16f-9c0d0e67c439
3ac2f699-de78-46f3-b16f-9c0d0e67c439	e9db6f47-671d-4f13-9db0-bbbbafb0a0c6	7cbecff1f2041cdd0dc181864237bda208050194fe43369349fed6cf6a171f28	2026-10-13 16:50:30.37+03	2026-10-06 16:50:30.372+03	2026-10-06 17:31:58.098+03	f89fff67-c9fa-473d-aaeb-dd2982352263
38876fd3-96d8-48b1-92a8-5401d1f4a710	e9db6f47-671d-4f13-9db0-bbbbafb0a0c6	af93def2e4118346fd3f0272e309718b4f9f34eebfdc60e5cf1941114e85f680	2026-10-13 17:32:16.405+03	2026-10-06 17:32:16.407+03	\N	\N
f89fff67-c9fa-473d-aaeb-dd2982352263	e9db6f47-671d-4f13-9db0-bbbbafb0a0c6	6a9ccf56f979d029100f72ddbcf95eab57620a9421f52e8ad6e2a7b84fa99421	2026-10-13 17:31:58.099+03	2026-10-06 17:31:58.101+03	2026-10-06 17:32:16.405+03	38876fd3-96d8-48b1-92a8-5401d1f4a710
5b82bd7c-e7f5-426b-8839-2e390e9a6741	465e0914-89b2-4ea6-b6b1-ec73fe880968	d89cfb287d1dac4634a6814707ea9448d4487765a742ed36fac9f8a0cf29b9f3	2026-10-13 17:33:26.47+03	2026-10-06 17:33:26.472+03	\N	\N
b381c56c-4b97-49d1-bb54-6c80888e794a	d90f7756-9ebd-4d67-9919-a2c98947a9d9	437b207f7540190afc33ae44354b1891fb2c167e7ea8d1ffd598f9a4abd4a895	2026-10-13 17:33:39.154+03	2026-10-06 17:33:39.155+03	\N	\N
bdee98aa-034b-46d9-b047-306c3014d008	e01fb126-562e-44fb-bba0-f49ed413922e	fde1ffaab2ce38f55bb4e9b75921e19e745e4aa41eecda2cf11d5b2729b038cc	2026-10-13 17:41:44.409+03	2026-10-06 17:41:44.41+03	\N	\N
2de0d6f6-85c7-45f9-9933-7552e3d226dc	bafc45e3-712f-44e6-978e-a3f7cdabc558	1a7ba2c50526b709a93b04234ce66e159e46bbc1ae7c903ddec9af205f3e67f1	2026-10-13 17:35:41.203+03	2026-10-06 17:35:41.204+03	2026-10-06 17:47:41.425+03	1ad19171-9cf8-40f0-b117-09f6e0e0d0a6
1ad19171-9cf8-40f0-b117-09f6e0e0d0a6	bafc45e3-712f-44e6-978e-a3f7cdabc558	9d7c6eea66e451d9fd882293d0f90fe3cc4c19739cbb348db103d8d15d32a2ae	2026-10-13 17:47:41.425+03	2026-10-06 17:47:41.427+03	2026-10-06 17:47:49.353+03	aaf82f5e-8854-4e77-920a-e5ff3d3af407
aaf82f5e-8854-4e77-920a-e5ff3d3af407	bafc45e3-712f-44e6-978e-a3f7cdabc558	26ba412ebf99020cd7cf885e1223e3d1797d049a12c1721b4575ab074ba5787b	2026-10-13 17:47:49.354+03	2026-10-06 17:47:49.355+03	2026-10-06 17:48:08.245+03	65862211-849e-4acc-9c78-e2bcbbc8645d
65862211-849e-4acc-9c78-e2bcbbc8645d	bafc45e3-712f-44e6-978e-a3f7cdabc558	a492b87cb093eea13b4c395872eb1573631377334af605087cceecd64be47c51	2026-10-13 17:48:08.245+03	2026-10-06 17:48:08.247+03	2026-10-06 17:48:29.234+03	2225aff0-dbaf-446d-9acf-497eedbd64ea
2225aff0-dbaf-446d-9acf-497eedbd64ea	bafc45e3-712f-44e6-978e-a3f7cdabc558	0c14e3d86805194f7a8a62841e251f9aefcf1b0fcc08f0b267d551d514bff1bf	2026-10-13 17:48:29.234+03	2026-10-06 17:48:29.236+03	2026-10-06 17:48:44.92+03	d484ed97-86cf-426c-b2c2-4ad6d410a484
48db69c4-395f-43d0-91d8-af03d92f792c	bafc45e3-712f-44e6-978e-a3f7cdabc558	6a06c769979779d4224130df26dc6ab46a730168761386dfb4e882cbd926ad0d	2026-10-13 17:49:05.861+03	2026-10-06 17:49:05.864+03	2026-10-06 17:49:51.408+03	6dc254f8-546b-47d2-ae38-7e017fa1e3e4
d484ed97-86cf-426c-b2c2-4ad6d410a484	bafc45e3-712f-44e6-978e-a3f7cdabc558	ebf7ac0941707af581b2f0bbb57986b454ab713e39be681403393c64a0a4251f	2026-10-13 17:48:44.92+03	2026-10-06 17:48:44.922+03	2026-10-06 17:49:05.861+03	48db69c4-395f-43d0-91d8-af03d92f792c
6dc254f8-546b-47d2-ae38-7e017fa1e3e4	bafc45e3-712f-44e6-978e-a3f7cdabc558	8e3c393e52092b76ee3aca047ea83c1e9bc461a13987c32597e4b0da89db435c	2026-10-13 17:49:51.408+03	2026-10-06 17:49:51.411+03	2026-10-06 17:49:55.372+03	2f5773e3-2888-47df-b862-9b6fbe8b21c2
2f5773e3-2888-47df-b862-9b6fbe8b21c2	bafc45e3-712f-44e6-978e-a3f7cdabc558	e4e34de7ba0c13fd8c553ba737f00b95b60298267b67b94225dbb6416f4a6153	2026-10-13 17:49:55.372+03	2026-10-06 17:49:55.374+03	2026-10-06 17:51:02.919+03	94815508-0ff2-49c8-b709-4031170a627c
b953ec92-61ef-4487-b1f0-d71546108024	bafc45e3-712f-44e6-978e-a3f7cdabc558	ad12bc0351d715252e0dcc1025ff2404b272b016fcb366e1b0db84772bd2ef60	2026-10-13 17:52:39.056+03	2026-10-06 17:52:39.077+03	\N	\N
94815508-0ff2-49c8-b709-4031170a627c	bafc45e3-712f-44e6-978e-a3f7cdabc558	e8679c09c2b5adc80c752d9e401451f580785820a0dd512c432895e720df2f6e	2026-10-13 17:51:02.919+03	2026-10-06 17:51:02.921+03	2026-10-06 17:52:39.055+03	b953ec92-61ef-4487-b1f0-d71546108024
1e6ae7a8-9938-473c-a894-5652cbe2a5d7	ff50d5ae-8f14-4d7c-bae2-baeae7261c69	fb1f58df13e84cd988c91be1aa3557039abeda812786f7df592a8ba3a30dcbff	2026-10-13 17:53:14.376+03	2026-10-06 17:53:14.383+03	\N	\N
31ed0b2b-18f1-4554-ad41-4d8516b267df	ff50d5ae-8f14-4d7c-bae2-baeae7261c69	daf602b72e47e3db73b3348f52b94baa08cae87f286e0b31ae3754838733a620	2026-10-13 17:53:01.827+03	2026-10-06 17:53:01.828+03	2026-10-06 17:53:14.376+03	1e6ae7a8-9938-473c-a894-5652cbe2a5d7
a0ff4fe7-b3f7-4d1f-adc7-4689d010b2c1	dc2259e9-b0fa-4015-a812-cceeec09cf75	a966693326ace62f7edf0425e8f0372044df653f3412b84dbf8761b425edd26f	2026-10-13 17:54:57.594+03	2026-10-06 17:54:57.596+03	\N	\N
470a6a66-c1a0-4275-bdd7-66fcfabfe218	67908fb0-a8b2-4e31-97b8-b700ec25cc31	65c7f33470028fbb4e7fbd443c0a9b57804146c38c44d71fb1645d414a6e67e4	2026-10-13 17:57:17.353+03	2026-10-06 17:57:17.359+03	2026-10-06 18:03:23.077+03	816b0299-8861-4381-87e1-b5fe4d313346
816b0299-8861-4381-87e1-b5fe4d313346	67908fb0-a8b2-4e31-97b8-b700ec25cc31	652cbdd40eacb67097c44678461ceac7db3df5e0e65c11ad4b6ef9deafc4156b	2026-10-13 18:03:23.078+03	2026-10-06 18:03:23.08+03	2026-10-06 18:03:55.26+03	9afbbcd6-ed96-4996-945f-c4f67e4258a9
9afbbcd6-ed96-4996-945f-c4f67e4258a9	67908fb0-a8b2-4e31-97b8-b700ec25cc31	7392cee3a9fd1df34ba44d8e1080ad4c9902e819fd24dba98560c06abf0b03af	2026-10-13 18:03:55.26+03	2026-10-06 18:03:55.262+03	2026-10-06 18:04:58.079+03	c244bbc7-d2f0-48cc-ae59-c2bc22f8179c
c244bbc7-d2f0-48cc-ae59-c2bc22f8179c	67908fb0-a8b2-4e31-97b8-b700ec25cc31	a258ae705c44a0eae1813025e04c389da0d76ba36a888cb06ec0024f8d048c3b	2026-10-13 18:04:58.079+03	2026-10-06 18:04:58.081+03	2026-10-06 18:05:21.478+03	4e51860f-45c7-43f7-ab28-d4ac735be345
4e51860f-45c7-43f7-ab28-d4ac735be345	67908fb0-a8b2-4e31-97b8-b700ec25cc31	d87236a64a936799ddd882a7a0f5c99a98d9cf642790683a96b964e7ed6ef971	2026-10-13 18:05:21.478+03	2026-10-06 18:05:21.48+03	2026-10-06 18:05:51.769+03	afcea942-1e78-4feb-be30-c105ee03516e
afcea942-1e78-4feb-be30-c105ee03516e	67908fb0-a8b2-4e31-97b8-b700ec25cc31	b9f8272f8110c0f7aa331e7ae82ddea8285e52b927c7548a7df13c1b288e1113	2026-10-13 18:05:51.77+03	2026-10-06 18:05:51.772+03	2026-10-06 18:10:40.624+03	703e5af5-39e7-42d9-90ab-031331a67054
703e5af5-39e7-42d9-90ab-031331a67054	67908fb0-a8b2-4e31-97b8-b700ec25cc31	49a7e6a8530458a6f82c69e7342d39fd0e2cdb6189da1e5d8919ccbc9a54490b	2026-10-13 18:10:40.624+03	2026-10-06 18:10:40.625+03	2026-10-06 18:11:00.071+03	56199ee4-c77b-428f-881f-42ee7b9bf5a5
a50295c5-3612-4e40-acad-130e3a03658a	d4831ee9-3908-403a-b8d2-0434eab593ca	8b510a5658217f5b2c4df31c7cac3064738bb6b6d636a375bf524b5b3a5f430d	2026-10-13 18:13:53.651+03	2026-10-06 18:13:53.663+03	\N	\N
7e2d29cf-7289-4070-a542-2c9960840ee4	d28b7fef-3a7e-42ae-963c-14e1e5f6a85d	53601c80f4f50b9cb09277b91097b41fc11e074eb402f3aaa2a23353268dd205	2026-10-13 18:15:25.084+03	2026-10-06 18:15:25.086+03	\N	\N
0638806d-2b5b-4582-b005-30a02e673db0	d28b7fef-3a7e-42ae-963c-14e1e5f6a85d	b7caf50c1d287f74feafe749cf25734cfc670a650b8f2bedc887a5ea481be059	2026-10-13 18:15:24.93+03	2026-10-06 18:15:24.931+03	2026-10-06 18:15:25.084+03	7e2d29cf-7289-4070-a542-2c9960840ee4
0d459f9f-03ef-4108-93a9-53462c9f13b7	9be51f80-7168-4c38-9fe3-f071262de581	f83d3426f85144e80729d9efdb8394558ed8abbd6ce3b40eab71c09a9e653b18	2026-10-13 18:16:41.492+03	2026-10-06 18:16:41.494+03	\N	\N
fe0dc9b7-270a-4948-aa7b-3f29d4cfc80c	9be51f80-7168-4c38-9fe3-f071262de581	ed3f0114acc25c2b1426005d88ebe2ac6b969578bf5333bf296b8b1c758d03cc	2026-10-13 18:16:41.347+03	2026-10-06 18:16:41.348+03	2026-10-06 18:16:41.492+03	0d459f9f-03ef-4108-93a9-53462c9f13b7
56199ee4-c77b-428f-881f-42ee7b9bf5a5	67908fb0-a8b2-4e31-97b8-b700ec25cc31	153daba2014a85a5f8488e76fe7aeaf2f3853cb35f5a833f42644f42bc10a0bb	2026-10-13 18:11:00.071+03	2026-10-06 18:11:00.073+03	2026-10-06 18:20:21.112+03	2012b0cf-e14c-4013-89d7-7eb5d2a6d18f
2671b967-2429-431c-a929-36867e6f62cd	b9f20ea2-ccd0-4c4e-a25e-92927da7d299	2b5980002c99de6464ff032b31344832e3b96edc37acdee33a1a90158b459aca	2026-10-13 18:21:09.504+03	2026-10-06 18:21:09.506+03	\N	\N
f69577b1-cbaf-4a6f-809a-9ad925824cff	b9f20ea2-ccd0-4c4e-a25e-92927da7d299	46bb286cf0131363502e42a1ca106c23188ee002fb034782d135e6404e7e25b2	2026-10-13 18:21:09.353+03	2026-10-06 18:21:09.354+03	2026-10-06 18:21:09.504+03	2671b967-2429-431c-a929-36867e6f62cd
55cf1d09-6d62-4d21-b777-c3d1131d67ed	d2c66474-8a6d-47ac-9c5f-ecca99a63403	8ebeaa8725678ce09b3f8ab23fa39600801a8ea0a47149f405075f5fc44e2794	2026-10-13 18:21:57.162+03	2026-10-06 18:21:57.164+03	\N	\N
aad47d24-2a10-4ab4-a41f-41c647ef1757	d2c66474-8a6d-47ac-9c5f-ecca99a63403	e9d3cda8e5c8247993cb89b00398cfe5e7e81b4ef928e8011bfb6423d38d4962	2026-10-13 18:21:57.021+03	2026-10-06 18:21:57.022+03	2026-10-06 18:21:57.162+03	55cf1d09-6d62-4d21-b777-c3d1131d67ed
aea6d77d-6f35-48c5-a99e-22106154acc6	f904ca64-98f8-4345-950c-b528cee32bce	9914f272709b2e48b09439e3d6fadda4cc9911e4894e01b22df4128c45ddeb4c	2026-10-13 18:22:50.045+03	2026-10-06 18:22:50.047+03	\N	\N
8a7696d4-1584-4a96-8c09-91c2d8fcb333	f904ca64-98f8-4345-950c-b528cee32bce	44c77de5684589141fe98bb2aea6e9d8179403d862e4699ddae3ffebf55cfdcf	2026-10-13 18:22:49.901+03	2026-10-06 18:22:49.902+03	2026-10-06 18:22:50.045+03	aea6d77d-6f35-48c5-a99e-22106154acc6
a456391f-9493-4c69-b2d8-6cd9beb357cf	73033c48-d89d-4c2c-93a7-1cd5579b529c	86614e08dbc03ef6aed7b2d472ba50a0a38ecf3840f178fb5cddfead8b2608a8	2026-10-13 18:24:09.933+03	2026-10-06 18:24:09.934+03	\N	\N
831729ee-6f21-426e-a21a-dcaf1f393632	73033c48-d89d-4c2c-93a7-1cd5579b529c	36a981ff8e2f48721a0f04a8ad83d7b9ed4ff22b36d816060f0fd1735b4aa95e	2026-10-13 18:24:09.799+03	2026-10-06 18:24:09.8+03	2026-10-06 18:24:09.933+03	a456391f-9493-4c69-b2d8-6cd9beb357cf
da550f58-d259-4036-9f35-be76a1f29335	2de71df1-8552-4eaf-bcea-baba99c0e826	5db8ecb6caa452c0b19daef079c646d0205f0d2f2aacf05ee07c0d1f5e7fcecd	2026-10-13 18:25:03.225+03	2026-10-06 18:25:03.227+03	\N	\N
40a641c9-da28-4d3a-8861-0593ee5dee19	2de71df1-8552-4eaf-bcea-baba99c0e826	ad6f58e7636070d63eddbeabb7c495f9dbdcf13019c7839fb8222b816cb01020	2026-10-13 18:25:03.088+03	2026-10-06 18:25:03.089+03	2026-10-06 18:25:03.225+03	da550f58-d259-4036-9f35-be76a1f29335
c198cd40-201b-4344-aabe-c8f8a3dcb3ef	67908fb0-a8b2-4e31-97b8-b700ec25cc31	6a1d7b42349dc1963527f5ff1bf79989c36747324b8aabe4ef7d382347f569b0	2026-10-13 18:29:18.95+03	2026-10-06 18:29:18.952+03	\N	\N
2012b0cf-e14c-4013-89d7-7eb5d2a6d18f	67908fb0-a8b2-4e31-97b8-b700ec25cc31	9ba22f221dc0a2995d0a4e663fa6a50d3aafccbc628c2c875ad434dd94924984	2026-10-13 18:20:21.112+03	2026-10-06 18:20:21.114+03	2026-10-06 18:29:18.95+03	c198cd40-201b-4344-aabe-c8f8a3dcb3ef
7566ddd8-a439-4fdf-8eff-cce7916af471	b55b988e-d165-4f29-897b-18b95886ec11	6554df08daa17b409d6b00be41a743149d6dc7b9ae1e6e838ec3356fa913cdcb	2026-10-13 18:33:19.56+03	2026-10-06 18:33:19.561+03	2026-10-06 23:41:02.477+03	c4771a07-8bde-45e0-b657-00165b1f9774
a21441b6-6cfe-46f6-b2e1-2357f3df3644	b55b988e-d165-4f29-897b-18b95886ec11	37930b4279161ffb5bbc19dbd65d7195dada65437f1db81ffa5716b2e030202a	2026-10-13 23:41:07.733+03	2026-10-06 23:41:07.739+03	\N	\N
c4771a07-8bde-45e0-b657-00165b1f9774	b55b988e-d165-4f29-897b-18b95886ec11	3993b9000e3bc3e0f2cf754050da94e1c0c449af36fbf41f788f4fd9b7ea2ea7	2026-10-13 23:41:02.477+03	2026-10-06 23:41:02.483+03	2026-10-06 23:41:07.733+03	a21441b6-6cfe-46f6-b2e1-2357f3df3644
b4c38daf-4b36-46ab-958a-e055d12de8e6	d1e2ccc6-422e-43f0-9818-50d6fc6988f9	c347322407674b7e0535e72adc6426ce5b9bf2451431eff3fc0f17f5b8f64cb7	2026-10-13 23:43:36.469+03	2026-10-06 23:43:36.47+03	\N	\N
74bb138e-8f4e-4b86-a35d-776ecae71cde	d1e2ccc6-422e-43f0-9818-50d6fc6988f9	d585eed3c9907806400b82fbbfd8ae47e38f868edd70ac36bd73894ff0117cb1	2026-10-13 23:41:26.454+03	2026-10-06 23:41:26.459+03	2026-10-06 23:43:36.469+03	b4c38daf-4b36-46ab-958a-e055d12de8e6
f674d2ec-9146-45f4-bc30-0a9280bc3be7	0186a4de-484e-4c19-98c1-71cb05bf5c74	4a82ec2392b4bab97619941b68867174851628c3786cdf7fb115d84830ffcfdb	2026-10-13 23:45:27.339+03	2026-10-06 23:45:27.342+03	\N	\N
0509ada4-e79b-4f05-be2c-649bab2fedae	75cf01dc-31f1-4187-b220-1776483dced7	ec9bcd34f596eb94ed489a7c8252c7fe801f1068112c803e4c5894c92c0c4980	2026-10-13 23:46:37.946+03	2026-10-06 23:46:37.959+03	2026-10-06 23:46:42.058+03	7bed232a-edab-4533-9203-6ae5fa20191c
7bed232a-edab-4533-9203-6ae5fa20191c	75cf01dc-31f1-4187-b220-1776483dced7	99368d327b49bf593cb81a39a67d2482dda84d7f857dad9fbab2833afc42adec	2026-10-13 23:46:42.058+03	2026-10-06 23:46:42.072+03	2026-10-07 12:19:40.85+03	04af9ee4-b47d-4cad-a0f5-fba959f27a66
04af9ee4-b47d-4cad-a0f5-fba959f27a66	75cf01dc-31f1-4187-b220-1776483dced7	9254bd734258b22ece91d16032b9ebd22b14d899a302b2e7fdbb6f8affd081a8	2026-10-14 12:19:40.85+03	2026-10-07 12:19:40.853+03	2026-10-07 12:19:50.86+03	7cf25a7f-7b64-4039-8143-27128479428c
7cf25a7f-7b64-4039-8143-27128479428c	75cf01dc-31f1-4187-b220-1776483dced7	7081a27875018d37f956f4f2b47d9da19a3dcee257ce6f30141147f0cfd34468	2026-10-14 12:19:50.86+03	2026-10-07 12:19:50.863+03	2026-10-07 12:22:57.646+03	73c108f5-486c-4704-8031-2e0fa6d61b5e
73c108f5-486c-4704-8031-2e0fa6d61b5e	75cf01dc-31f1-4187-b220-1776483dced7	9bebf093f10ac3e880075610d7cb5a58eab5bf1e2060e61f5573a8ef72858e9c	2026-10-14 12:22:57.647+03	2026-10-07 12:22:57.65+03	2026-10-07 12:22:58.605+03	f1b78d42-e3bb-44b1-aa7f-7336b602bfc3
f1b78d42-e3bb-44b1-aa7f-7336b602bfc3	75cf01dc-31f1-4187-b220-1776483dced7	3139346534c66b6664b7e4f882e5faa60cf9fa9abfb97f79d44b3e589318ad94	2026-10-14 12:22:58.605+03	2026-10-07 12:22:58.608+03	2026-10-07 12:25:25.162+03	c4200c63-beab-449d-a4b4-c1d529fd293e
c4200c63-beab-449d-a4b4-c1d529fd293e	75cf01dc-31f1-4187-b220-1776483dced7	3695da7cfb2c6d9ad888135dd63892a6e11479419e24d266f159855b68d6a366	2026-10-14 12:25:25.162+03	2026-10-07 12:25:25.164+03	2026-10-07 12:25:25.906+03	c01252c1-833e-47e1-baab-6171c4303ff3
c01252c1-833e-47e1-baab-6171c4303ff3	75cf01dc-31f1-4187-b220-1776483dced7	02620a22310fa50a751daa02d38614df7871675a5cec89a47fcc0f4d0c839491	2026-10-14 12:25:25.906+03	2026-10-07 12:25:25.908+03	2026-10-07 12:26:08.848+03	80c08f98-3e1c-44f2-86f2-473d09b4af57
dbe51fd3-bd75-4009-87e1-bc43292a6291	75cf01dc-31f1-4187-b220-1776483dced7	590450f2b3a13f20c136c1f3e63ae3a4d51216caaa51c17031a1f3cdec7c10d4	2026-10-14 12:27:04.468+03	2026-10-07 12:27:04.47+03	\N	\N
5944fa21-c8bd-4398-91a0-0eabb1797f92	02c0e66b-cb83-4770-be56-5b63fdca5c1d	5f0f29985cb3aaf693162371a7d9f92c38b329dc09195824bc9843089fab7d0a	2026-10-14 12:29:16.301+03	2026-10-07 12:29:16.302+03	\N	\N
80c08f98-3e1c-44f2-86f2-473d09b4af57	75cf01dc-31f1-4187-b220-1776483dced7	0fbfd63804433b860160ceee6b5eb011626be6fe6aa56608be5f5bb9f4217d09	2026-10-14 12:26:08.848+03	2026-10-07 12:26:08.85+03	2026-10-07 12:26:09.794+03	aecec333-cecd-46bf-b1ce-fd1e74f16f4b
aecec333-cecd-46bf-b1ce-fd1e74f16f4b	75cf01dc-31f1-4187-b220-1776483dced7	4d221fd57d3ef8d6f8be38b89bdf6b79c420ffd767d3a60b32c68bf51c507c44	2026-10-14 12:26:09.794+03	2026-10-07 12:26:09.795+03	2026-10-07 12:26:40.21+03	1ca9c75d-831f-4179-8e47-4518550726a3
1ca9c75d-831f-4179-8e47-4518550726a3	75cf01dc-31f1-4187-b220-1776483dced7	4fac795251bbf640dcd23dd71c1798cb9e200fef0baabd30459cd3786c3290ea	2026-10-14 12:26:40.211+03	2026-10-07 12:26:40.213+03	2026-10-07 12:26:40.763+03	9e6ce9f5-26c1-48c8-b274-36716a49c537
9e6ce9f5-26c1-48c8-b274-36716a49c537	75cf01dc-31f1-4187-b220-1776483dced7	25648d7cb9a1636f29a1b102bf1977e154e6183f275329f1a874e04a8d15b034	2026-10-14 12:26:40.763+03	2026-10-07 12:26:40.765+03	2026-10-07 12:27:04.468+03	dbe51fd3-bd75-4009-87e1-bc43292a6291
cd44f75f-9f28-4f35-8cd7-bb9f76180858	5d02415a-0a80-4c8a-a65c-353af5b87744	8ddb4c69817a2169687fd2ba470690cd1dbc1f2df1ddab743a5de4867813eed6	2026-10-14 12:30:53.778+03	2026-10-07 12:30:53.779+03	\N	\N
83ad1b89-3fa2-4449-b8bc-c62ecc8d2c8e	5d02415a-0a80-4c8a-a65c-353af5b87744	e6552291b1ffc0a58ea349c8e53e540da03bf356e98ff73392771fbc1c10f107	2026-10-14 12:29:45.121+03	2026-10-07 12:29:45.121+03	2026-10-07 12:30:53.778+03	cd44f75f-9f28-4f35-8cd7-bb9f76180858
0a009de2-e9bc-43a1-ab3f-117077efc54c	bed02d1a-749e-4571-a0d2-2667df683cea	40cae6f740015972b771048ebfc704db7f673a2b7b3daa77450bb03e16c9a20a	2026-10-14 12:32:51.794+03	2026-10-07 12:32:51.796+03	\N	\N
20083651-8a5f-4f50-9388-3a2f7117849a	67cfcbf5-f607-4f98-ba77-83ed89454be0	b3cbac8ce9b35c59a2f38db5e73b7ab0f6f4adca98d45381fc430b5d7f23fdac	2026-10-14 14:37:25.691+03	2026-10-07 14:37:25.695+03	\N	\N
ad02072f-cd56-4d83-9be9-08038edb22dc	67cfcbf5-f607-4f98-ba77-83ed89454be0	687736d7f678a82ad2e84ac5b4fbb12fad3543cf84d6ee0a65ccac8416efe742	2026-10-14 12:33:21.939+03	2026-10-07 12:33:21.94+03	2026-10-07 14:37:25.691+03	20083651-8a5f-4f50-9388-3a2f7117849a
fa5d5f64-420b-4ebe-87a6-dbaba8f42b25	3f47cb5a-e2a4-4c9d-afc7-8fa29ff06821	61ad65504512a7f60abf8cd98a4803065e50b321e1157f0cc8cb922b85fa11e2	2026-10-14 14:37:52.92+03	2026-10-07 14:37:52.922+03	\N	\N
ed0c36b0-66f3-472a-bd8b-5983d31c4c11	29a40eff-22e2-4a28-8069-bc90061ca1b8	b1faad132a4508a9563106005034c188cfed4ea24863ff235dbac46a87e261e4	2026-10-14 14:39:02.556+03	2026-10-07 14:39:02.557+03	\N	\N
6963cdb5-b7fa-4f7f-b87a-01f01cd9cb18	3ae0930b-7903-438d-b13d-1c74dfd4dfe8	041e47da407bc03ef6aa2f012ca746c0701d2c56ee11bed4225d9c8e82cf29f9	2026-10-14 14:41:20.446+03	2026-10-07 14:41:20.447+03	2026-10-07 14:47:27.303+03	eadace61-36cd-4ca9-b49a-cbf30efb8ca8
eadace61-36cd-4ca9-b49a-cbf30efb8ca8	3ae0930b-7903-438d-b13d-1c74dfd4dfe8	7ce16135166ac999a65aace9cb14ff62e60b9659ab57fe3e886ce5f599f9d671	2026-10-14 14:47:27.303+03	2026-10-07 14:47:27.306+03	2026-10-07 14:50:14.01+03	296bdbba-11da-4fb6-a495-2c77a70cae31
296bdbba-11da-4fb6-a495-2c77a70cae31	3ae0930b-7903-438d-b13d-1c74dfd4dfe8	c9132bedf156dcbaf7e57cdab47fe8be76b4ed9d9f58153f50e22ca66fa34360	2026-10-14 14:50:14.01+03	2026-10-07 14:50:14.012+03	2026-10-07 14:51:00.325+03	8d1f4d61-5980-4f22-87a4-abaaa9c70aa6
8d1f4d61-5980-4f22-87a4-abaaa9c70aa6	3ae0930b-7903-438d-b13d-1c74dfd4dfe8	03a52c77d1079a64e0fd2e6fed1c8d529595b2e67fa4d8d9d0bed973e01845d8	2026-10-14 14:51:00.325+03	2026-10-07 14:51:00.326+03	2026-10-07 14:55:36.805+03	659b9ca0-dff0-43fa-9d13-26dda61b7f51
659b9ca0-dff0-43fa-9d13-26dda61b7f51	3ae0930b-7903-438d-b13d-1c74dfd4dfe8	f4a6329afd5899079c4876e0792388a4d7c63807fd656ef9b91054d1907309de	2026-10-14 14:55:36.805+03	2026-10-07 14:55:36.806+03	2026-10-07 14:55:52.612+03	692a3b6f-a673-44c1-8997-75db09a69179
692a3b6f-a673-44c1-8997-75db09a69179	3ae0930b-7903-438d-b13d-1c74dfd4dfe8	54faff05ff382f541af6a749b756e5da893d10e45e52d38817d046330841347d	2026-10-14 14:55:52.612+03	2026-10-07 14:55:52.615+03	2026-10-07 14:56:10.979+03	81c71318-383b-4fcb-85bc-94cf09f469be
81c71318-383b-4fcb-85bc-94cf09f469be	3ae0930b-7903-438d-b13d-1c74dfd4dfe8	9b26e8867a681405586eb33b48ba767d191f674bb9514cc9818cfa4700be2e15	2026-10-14 14:56:10.979+03	2026-10-07 14:56:10.981+03	2026-10-07 14:56:11.66+03	e9b71209-2c19-4520-8ccc-d16f744873bb
e9b71209-2c19-4520-8ccc-d16f744873bb	3ae0930b-7903-438d-b13d-1c74dfd4dfe8	8c7c7055554dda4ec87feae9cbe78c76ec956dbcd97d0ee52097fe8bb2dea8d5	2026-10-14 14:56:11.66+03	2026-10-07 14:56:11.662+03	2026-10-07 14:56:15.933+03	c6eed9e3-d07c-4c5c-8429-c972e8850d78
c6eed9e3-d07c-4c5c-8429-c972e8850d78	3ae0930b-7903-438d-b13d-1c74dfd4dfe8	3593f22e9d83f52e79cf59d23779c9e4b40f877c5eea5a839598fdf18a779135	2026-10-14 14:56:15.933+03	2026-10-07 14:56:15.934+03	2026-10-07 14:56:23.915+03	e6e57f1b-c434-4dee-9d15-6fc3e1f5bdfe
bdbf3fb0-c838-4a70-89fe-d15451025f42	3ae0930b-7903-438d-b13d-1c74dfd4dfe8	81d1ec71d39348b99833ca3e10e54a11c4b746cf67025e303fd58014780457cc	2026-10-14 14:56:46.208+03	2026-10-07 14:56:46.21+03	\N	\N
e6e57f1b-c434-4dee-9d15-6fc3e1f5bdfe	3ae0930b-7903-438d-b13d-1c74dfd4dfe8	dfb237f95db1fc1fa9d3a265a281d0dd59eb063a8a11c4dc4b353c1cc869a4ab	2026-10-14 14:56:23.915+03	2026-10-07 14:56:23.918+03	2026-10-07 14:56:46.208+03	bdbf3fb0-c838-4a70-89fe-d15451025f42
28d15bf8-ded0-4bcf-8e24-451d1ce7b418	0960f211-bf12-4657-9134-de8215f96621	4516d4f3ddb150749aec3f2c4390c7e16e4b1e519c9c15da91ba84e0d28246ac	2026-10-14 14:58:55.622+03	2026-10-07 14:58:55.623+03	\N	\N
01ea72f9-839b-4cf0-a6dd-d8041082369d	5a48f70c-a3c4-41c5-a4b6-a8fdd26c50cb	8e78a3c72b9f982edf5baaf4475f36773747d02ca32cb20b458f5ca25ee9ec79	2026-10-14 15:02:27.25+03	2026-10-07 15:02:27.251+03	\N	\N
e10df0e9-52a1-4abc-83ae-505a2a43dbf6	0890175e-21fa-48ed-bb4d-89c98ce323c2	2324df4918ab2cb25ed0c280bfb856a72a168899f242446dd10d62610051b169	2026-10-14 15:04:08.024+03	2026-10-07 15:04:08.025+03	\N	\N
fb7b364f-8814-4a7d-a2f2-8b1b266d41d7	195eaa6f-2e8f-4550-a588-aed9b73c2e39	825a632649051b7779dcdf6c388389190bcc555a2b3f7006c79276ba14343d36	2026-10-14 15:12:43.063+03	2026-10-07 15:12:43.065+03	\N	\N
ff5ce628-5eec-4c5d-a337-b1db4d6560ad	195eaa6f-2e8f-4550-a588-aed9b73c2e39	220dc6ae05a585c42ed82a7aa6380a4512cdee76cfd7ac4f1497fb3f204ba535	2026-10-14 15:06:50.017+03	2026-10-07 15:06:50.018+03	2026-10-07 15:12:43.063+03	fb7b364f-8814-4a7d-a2f2-8b1b266d41d7
f1046399-2095-464a-bc59-4ffccd0be5ff	b0ba4b25-d8e7-4055-b261-bed930c7c3ca	3509983d77d3784e2d6abfe2f5db6966b07205552c6f1be628f4547b486c14a5	2026-10-14 15:14:14.032+03	2026-10-07 15:14:14.033+03	\N	\N
132dec5d-eeeb-4e94-8ca2-63370314902d	f14f7d65-1af7-4114-bbe8-d30cca026eae	cb53d94502726645a52a0d408a4adca114eb24338f54178183fc40165e9a4b4c	2026-10-15 14:18:53.111+03	2026-10-08 14:18:53.117+03	\N	\N
b642063a-358b-482e-b4f0-36f9b3795e04	f14f7d65-1af7-4114-bbe8-d30cca026eae	f0f2ba84f4a5615c7066c8a335e5ae2a1a4ae63472a4df99ebc9fb13cb6e0094	2026-10-14 15:19:45.201+03	2026-10-07 15:19:45.202+03	2026-10-08 14:18:53.11+03	132dec5d-eeeb-4e94-8ca2-63370314902d
3edaf36b-dc37-4f54-95bf-343d55c9e315	9cf2d390-48ec-4053-939e-d6e9bac02794	dbaeffc7948801013c70ddbdd269c799e4b2e174fb5f620ca9c6fbab56dcad26	2026-10-15 14:19:57.542+03	2026-10-08 14:19:57.543+03	\N	\N
4cb65375-db05-44a3-8f17-ffe1b65ca21a	382a5e00-4364-4b76-99fc-a323d0191e89	74a7c1d8e8a46c7ca57efb3468e2fbfdde2b96fa24a05744b1257f9fe4fb6f0e	2026-10-15 14:22:16.995+03	2026-10-08 14:22:16.996+03	\N	\N
28a4a6b6-0891-4f09-bc95-323bcef15a9f	144228e4-07d8-4c56-afde-50aa0ef6365f	cb15b0f648313c68173bd6ada5cb5b7ac605ee5ae451a21f9469b06417abc493	2026-10-15 14:23:02.343+03	2026-10-08 14:23:02.344+03	2026-10-08 14:24:33.748+03	1a91bfb3-2787-471d-8594-4d3e743eba85
1a91bfb3-2787-471d-8594-4d3e743eba85	144228e4-07d8-4c56-afde-50aa0ef6365f	ae6151d5354a5988fadfcb8844f68365aafa9d6894cb9a0b640d2c5fa7c2912a	2026-10-15 14:24:33.748+03	2026-10-08 14:24:33.751+03	2026-10-08 14:25:04.573+03	5ee9d159-68db-4add-9e80-791e581498f9
5ee9d159-68db-4add-9e80-791e581498f9	144228e4-07d8-4c56-afde-50aa0ef6365f	929b1f73b7e6417d7832c2b6b41edc2c8e9728d072678ae9ea650c03e758d8f2	2026-10-15 14:25:04.573+03	2026-10-08 14:25:04.576+03	2026-10-08 14:26:51.438+03	1e170219-c395-45b4-84da-b9379d602ccb
00768ec5-b577-4958-bafa-73bad5723ce1	144228e4-07d8-4c56-afde-50aa0ef6365f	38c49fbaf09d3d4145d49585df5fcbfc571df5aae234faf082d8fe30a3418553	2026-10-15 14:28:33.539+03	2026-10-08 14:28:33.542+03	\N	\N
1e170219-c395-45b4-84da-b9379d602ccb	144228e4-07d8-4c56-afde-50aa0ef6365f	4a78704de18d9724b6556e7b1211bd6745449cdc2446ee64ce62bef7fe7b9ef2	2026-10-15 14:26:51.438+03	2026-10-08 14:26:51.439+03	2026-10-08 14:28:33.539+03	00768ec5-b577-4958-bafa-73bad5723ce1
ce108a35-c2ee-4c5a-a2c8-f4e44d3def18	73415f80-fc2e-4f79-be73-f8c7c9e346fe	a5bb7208514d2c293eb9c1f15463ec0b655a980d704065d340e94fa07070f6e0	2026-10-15 14:30:30.954+03	2026-10-08 14:30:30.955+03	\N	\N
214b8870-12fd-4eec-a5a2-077dc91922f6	eeb2b4cf-9180-4d05-af66-2b8fc60a196d	f850581526eca2bc3e8b5e4d7b23cc7dd30f14639ef2d2875a4eeca6ce4955c0	2026-10-15 14:30:53.454+03	2026-10-08 14:30:53.455+03	\N	\N
2d0c8373-5349-411f-90d2-d427c39b2175	44173165-5b9b-4423-ac19-3d94aeb50bf0	366f6aa16f05bdee42b5da3c2633e2ffe298fb36cda22c42d09379f1ec44f10d	2026-10-15 14:32:51.131+03	2026-10-08 14:32:51.132+03	\N	\N
d5247fe5-49fb-405d-9b32-1ddc5e384cb0	261397ee-efbd-44d7-834e-1f90c758dbae	73f3b571d39d4dbdc6e297ea0d7c86a1ec20fbaa03094fd80c6a2e3326e03c17	2026-10-15 14:43:01.938+03	2026-10-08 14:43:01.94+03	2026-10-08 14:46:48.967+03	da3fbfbf-1343-4d08-a1be-79291d905eb1
da3fbfbf-1343-4d08-a1be-79291d905eb1	261397ee-efbd-44d7-834e-1f90c758dbae	bd30c3d00dd953da303bce8c6ca4884cf998b928ac6e6631b82566c1f2067610	2026-10-15 14:46:48.967+03	2026-10-08 14:46:48.969+03	2026-10-08 14:49:56.243+03	86e5075f-53be-48de-bf58-0f9b27bf0651
86e5075f-53be-48de-bf58-0f9b27bf0651	261397ee-efbd-44d7-834e-1f90c758dbae	351284fb6732db666d2943121c86c1e956150481d84da99ce99f0a00dfb29e3f	2026-10-15 14:49:56.243+03	2026-10-08 14:49:56.247+03	2026-10-08 14:50:18.965+03	216d1d9c-7447-4643-b4aa-60e3951c0142
216d1d9c-7447-4643-b4aa-60e3951c0142	261397ee-efbd-44d7-834e-1f90c758dbae	4c8632afbe84c7fa1112cc4c2d4f6a4e66c34f97b97ae462124b4f0b939b544f	2026-10-15 14:50:18.965+03	2026-10-08 14:50:18.967+03	2026-10-08 14:56:27.278+03	dae3cec2-d88f-4a54-ba21-d5e28521a797
92ec1924-a421-4fce-b204-14356afcf5e5	261397ee-efbd-44d7-834e-1f90c758dbae	eff1075b807f05f64de5fd41a593948d3a8f266d2de9fa38abbd5d8dd9617f89	2026-10-15 14:56:28.971+03	2026-10-08 14:56:28.973+03	\N	\N
dae3cec2-d88f-4a54-ba21-d5e28521a797	261397ee-efbd-44d7-834e-1f90c758dbae	79a68e3667d40ca98c60e2ebca8102f8cad2a9226e4123186300e6c8fd3c7796	2026-10-15 14:56:27.278+03	2026-10-08 14:56:27.28+03	2026-10-08 14:56:28.971+03	92ec1924-a421-4fce-b204-14356afcf5e5
054f742c-2f07-4c76-9f74-d8c6b0731014	e56d9858-5f2a-4f21-a6bb-21fec4f42e7f	886a6ad1a0bebddefc927ef2b8d10d129d92fd942e99fc5d167c73e19a362b0c	2026-10-15 14:57:08.538+03	2026-10-08 14:57:08.539+03	\N	\N
c0af6076-d16e-4ffc-acdc-62bf18bbde72	7b8f6547-434f-46e0-949c-047a71b4dc7e	007981d40adf2cd1c8c2c843a8280e3563ba9c40ce110391e8c81bb00863ed02	2026-10-15 14:59:05.863+03	2026-10-08 14:59:05.866+03	\N	\N
09a95234-3a3b-4c4c-9b76-b7b04334054c	25461f5f-312e-4eb3-8054-1e2519818bd4	c09920dac95239e9932baf1455c0625135a36fe4e182e200d5b215dad0721011	2026-10-19 13:44:45.452+03	2026-10-12 13:44:45.453+03	\N	\N
ea9a069c-724a-434c-a0b1-6c268083fe9a	f79eb197-e32e-43ee-8109-81ceac55e87e	02657e5609bd1965b8c56e8e547f764be458926f5bffe0655a5cc31d808c9dd1	2026-10-19 13:44:46.483+03	2026-10-12 13:44:46.483+03	\N	\N
5acc8d43-b664-40ab-a9c4-05f5a1a32a15	7b8f6547-434f-46e0-949c-047a71b4dc7e	9959805531178456ede26a96b47c60124bc4f9f9bc63908cdaf565ec5350b098	2026-10-15 14:59:01.544+03	2026-10-08 14:59:01.546+03	2026-10-08 14:59:05.863+03	c0af6076-d16e-4ffc-acdc-62bf18bbde72
93938ee6-8dd6-4fd5-8937-c47e7f6a2f49	2e728919-9b64-44ea-b96a-f729cf1ea89b	3e3e98ba1718822ae822d42af0414c87c34f9baf8dc709b7a8ede129a558164f	2026-10-15 15:11:23.856+03	2026-10-08 15:11:23.858+03	\N	\N
0d531d45-40fa-4c88-a184-a337681eb2a1	2e728919-9b64-44ea-b96a-f729cf1ea89b	8d190e85ac71d4723d112552cf44b0f9e211af3ecc5744c8bcf71433f942f208	2026-10-15 15:03:34.448+03	2026-10-08 15:03:34.449+03	2026-10-08 15:11:23.856+03	93938ee6-8dd6-4fd5-8937-c47e7f6a2f49
3e9d926f-6d0c-4193-b649-fb10e8cbece2	110dea84-f1b0-48c7-8301-b250e0fffa50	ae4eb274175e63fcc7c8834f76b7a22e8a4a53c619e931ee58457685924c976b	2026-10-15 15:12:02.984+03	2026-10-08 15:12:02.985+03	\N	\N
0b298b49-032d-4d77-8275-b887d93d91e5	7240508f-aa33-4b96-842e-b78e1eee1988	3e3d3b47cb605fa79771c79939f8ec5a8ad8883ca9eed84ef7bdeaba8f5cfe88	2026-10-15 15:15:50.462+03	2026-10-08 15:15:50.462+03	2026-10-08 15:25:55.441+03	02f9641c-9a1e-4d52-9f00-ab6bcfe6aa48
20ebaafe-c21a-4ede-9b41-49544b197d49	7240508f-aa33-4b96-842e-b78e1eee1988	fe0ab7f9f1c901dbe9883f75acb6357363670c2e6431ad66cffb0eace394087a	2026-10-15 15:27:59.22+03	2026-10-08 15:27:59.221+03	\N	\N
02f9641c-9a1e-4d52-9f00-ab6bcfe6aa48	7240508f-aa33-4b96-842e-b78e1eee1988	6e8806d6d3c75406df01e5e806f69abeee09708db385efaa461351c690c448f8	2026-10-15 15:25:55.441+03	2026-10-08 15:25:55.443+03	2026-10-08 15:27:59.22+03	20ebaafe-c21a-4ede-9b41-49544b197d49
382d6348-beda-4c0e-8311-2511892cf87f	928d9638-6520-40e6-8d0b-94ddf26c8e20	75d0b1f58a479b3d48e5033633a83297d82f6137813bb258fb6761464d780d27	2026-10-15 15:32:48.396+03	2026-10-08 15:32:48.397+03	2026-10-08 15:33:01.169+03	14a20d50-2cab-40ac-b0db-45d2d7c8a119
3678d17c-8144-4833-8053-3c06caafe13c	928d9638-6520-40e6-8d0b-94ddf26c8e20	fe5214bec01500d2d10daaa5a6b9063fe73e151a2f819cdec20783be8ee533e4	2026-10-15 15:33:18.668+03	2026-10-08 15:33:18.669+03	\N	\N
14a20d50-2cab-40ac-b0db-45d2d7c8a119	928d9638-6520-40e6-8d0b-94ddf26c8e20	1b28e551e2d5d189d5c17773d06bf1efb8f2dc580cfe4c98a7a73d8fb598a04e	2026-10-15 15:33:01.169+03	2026-10-08 15:33:01.17+03	2026-10-08 15:33:18.668+03	3678d17c-8144-4833-8053-3c06caafe13c
7c38e5bd-6a53-4ca5-a2a6-c0685c705670	2947d374-9127-4878-be49-d39bdc36638e	7b62884531b52b349912f6938756aeb72ccdc55bb560dc53bbf4566e0a92475b	2026-10-15 15:34:20.688+03	2026-10-08 15:34:20.693+03	2026-10-08 15:34:53.393+03	45b0fab9-8516-48fa-8fea-34b3c32b6c95
45b0fab9-8516-48fa-8fea-34b3c32b6c95	2947d374-9127-4878-be49-d39bdc36638e	1f1fb6df878a912583a4d83136c4af41a0a5169e10517e9d923831c589d2bf10	2026-10-15 15:34:53.393+03	2026-10-08 15:34:53.399+03	2026-10-08 15:34:55.484+03	88e1b636-2ccc-4b4c-8325-428b46a6e6d0
88e1b636-2ccc-4b4c-8325-428b46a6e6d0	2947d374-9127-4878-be49-d39bdc36638e	92fa0281a5fad2316f1c9e410f663cf096425368159b24bb8a81fa84dbbeaf47	2026-10-15 15:34:55.485+03	2026-10-08 15:34:55.49+03	2026-10-08 15:35:18.994+03	cdf8b26f-492a-4dc8-a682-995735a2b7e8
cdf8b26f-492a-4dc8-a682-995735a2b7e8	2947d374-9127-4878-be49-d39bdc36638e	fa7aab70b4370dcf38085096d67956305eca3f2aa79e9a2b89066c0465860546	2026-10-15 15:35:18.994+03	2026-10-08 15:35:18.995+03	2026-10-08 15:35:38.641+03	d89cbb43-3f31-48eb-b444-8dfe1025f41c
7ca104e8-0c49-4ba8-a051-51f5f79f63c7	2947d374-9127-4878-be49-d39bdc36638e	513fd91ec809eac2a561f9537fb11decc5b949aa8455c7bf8d9ef9fe137ad496	2026-10-15 15:35:39.531+03	2026-10-08 15:35:39.534+03	\N	\N
d89cbb43-3f31-48eb-b444-8dfe1025f41c	2947d374-9127-4878-be49-d39bdc36638e	b50d5d3101a85003724da85c1d5eb19f1088545ab472494cffec38e67af7ad2e	2026-10-15 15:35:38.642+03	2026-10-08 15:35:38.644+03	2026-10-08 15:35:39.531+03	7ca104e8-0c49-4ba8-a051-51f5f79f63c7
f4a5aae8-4593-4a89-855a-810960069d35	b98aef35-85f0-463f-8d93-b9793df48f6c	45a48d7d0131bd80608e5f79018bacb52fe2dd7d072878577a20222b17d2ccdd	2026-10-15 15:35:48.738+03	2026-10-08 15:35:48.74+03	2026-10-08 15:36:07.279+03	8064993f-a35e-472e-8a16-71ed009bd765
8064993f-a35e-472e-8a16-71ed009bd765	b98aef35-85f0-463f-8d93-b9793df48f6c	c58332bd401002d625b437a84860cdc89ebe4ef435d017d0f182270d460f368d	2026-10-15 15:36:07.279+03	2026-10-08 15:36:07.281+03	2026-10-08 15:36:12.522+03	59d6f98e-6225-4efd-806d-bb32f5115e41
93ffc72f-6b4d-4cc8-861c-f5e0d3f9ca31	b98aef35-85f0-463f-8d93-b9793df48f6c	b3957c7b28baaf463f697b1fb3e21903fafd516a37a4066addca69045b8c9c5c	2026-10-15 15:36:21.57+03	2026-10-08 15:36:21.572+03	\N	\N
59d6f98e-6225-4efd-806d-bb32f5115e41	b98aef35-85f0-463f-8d93-b9793df48f6c	a5d77f62ad657b007eb64be2d29faa1e981752a202aefa0205cdc4c887cf1415	2026-10-15 15:36:12.522+03	2026-10-08 15:36:12.524+03	2026-10-08 15:36:21.57+03	93ffc72f-6b4d-4cc8-861c-f5e0d3f9ca31
d96c492a-ffc5-4a29-b41f-421ee294e8af	c27b810f-714a-49a4-90a7-453e3ace96fb	c49d7982b176588b2d02e2e5808d313ff1ce41275954d47989d5a1aa8ef82e4e	2026-10-15 15:37:34.541+03	2026-10-08 15:37:34.543+03	\N	\N
5f183429-25cc-497a-8323-f1ea383f366f	55acb8ef-3e91-416f-9673-5f638cb65a50	9048161c1481a9d1d0f7982fa979caab2e52156a03e8c867cdf9258e0583f787	2026-10-15 15:38:23.619+03	2026-10-08 15:38:23.621+03	\N	\N
496a5037-fd46-4b39-bd10-16d603e3796a	0068b910-638f-423e-847e-bc972f32b25f	4ade28770dd82c629fa75c1d5ed7251e1f5548c86b36f7fcfe09d6dab51b5730	2026-10-15 17:35:31.819+03	2026-10-08 17:35:31.82+03	\N	\N
937f7dd0-265d-449b-9218-001983b7b995	4a03db3b-73a9-435a-8d13-ce58a3d3e1ee	a6d95410b075266c6fb2a74914c9691458c03078cfef8279c8340aafa5537814	2026-10-15 17:35:49.593+03	2026-10-08 17:35:49.594+03	\N	\N
9e02efeb-9f75-48fa-8b3d-b035a944eae4	df5c3edb-2655-4388-96ed-22afd34da72d	25e8f551c10230a5d86641ecb3ceeab3cb5b0cee99a8a190701222ed845b6421	2026-10-15 17:39:36.687+03	2026-10-08 17:39:36.689+03	\N	\N
3bf94671-6040-459c-8317-e368871c5a48	df5c3edb-2655-4388-96ed-22afd34da72d	9181cae972d04155ce9aa2e7472e5df09f3aac07d5d707a1dd683480e77d82c7	2026-10-15 17:38:50.602+03	2026-10-08 17:38:50.603+03	2026-10-08 17:39:36.687+03	9e02efeb-9f75-48fa-8b3d-b035a944eae4
df339646-2a03-4813-b309-71aadcb25f0d	077ea9ec-0a2d-4d59-983c-420eaa9327c4	38970cde0372e650f279cb35f6a3392ee2bd4c183ba912ef2758d6cb4a19bca7	2026-10-15 17:41:01.111+03	2026-10-08 17:41:01.113+03	\N	\N
189c37cf-7b14-451c-9593-71ac2b457402	077ea9ec-0a2d-4d59-983c-420eaa9327c4	614ac45695ce484b91b26fe8647c98ea2beeb79a12ba278f93cd23cda460d7fb	2026-10-15 17:40:14.751+03	2026-10-08 17:40:14.753+03	2026-10-08 17:41:01.111+03	df339646-2a03-4813-b309-71aadcb25f0d
92a5232f-5612-408c-b44b-78d0983314ea	4157eb17-8e53-4613-82ce-6c4e502628bd	6ef608781b03bb23d74f7a10c3627c7aa47fb3874491f73ae9a57e45e880b8a7	2026-10-19 00:24:37.009+03	2026-10-12 00:24:37.026+03	\N	\N
59cad852-cb8f-48ba-8b0e-974c930c3e08	4157eb17-8e53-4613-82ce-6c4e502628bd	4966b44fbe14fb1d71d4e4f72fbcdc2b1c576121761903917a9cde5d9aa6c419	2026-10-15 17:41:44.243+03	2026-10-08 17:41:44.244+03	2026-10-12 00:24:37.009+03	92a5232f-5612-408c-b44b-78d0983314ea
a37e6445-c62b-4ae5-9e2d-165f91ee9a1c	7ac38149-9944-4de3-894e-3a8f0a8cda12	8b48cc296a46e81a727ff852bfc481e0431e397383117defe84e40cda1fa1376	2026-10-19 00:28:18.702+03	2026-10-12 00:28:18.705+03	\N	\N
4e4a7f56-5da7-4816-924d-210dfea2ec5a	7ac38149-9944-4de3-894e-3a8f0a8cda12	8e1587b471b3164c64161eb900933f761276006a3a5a95db83cb07a12a1887a2	2026-10-19 00:25:01.262+03	2026-10-12 00:25:01.263+03	2026-10-12 00:28:18.702+03	a37e6445-c62b-4ae5-9e2d-165f91ee9a1c
a10351ba-9e13-4836-8721-0e101aa31ec7	6286ee12-aa18-4fd7-aef8-a440f2f2a6f3	88b488b6fca46253a421019775397d61d3e35d5bab4105bb16232bdb12470839	2026-10-19 00:29:32.708+03	2026-10-12 00:29:32.709+03	2026-10-12 00:30:39.466+03	a56ef339-d750-4ad5-8af1-31fe148e3663
5d3fbb71-0991-4409-8399-c5e13ed58f82	6286ee12-aa18-4fd7-aef8-a440f2f2a6f3	2d37ae94d601312ca9e5ff2281d92b57e3a2805509b6238ad0412e459f2e8f91	2026-10-19 00:30:49.063+03	2026-10-12 00:30:49.064+03	\N	\N
a56ef339-d750-4ad5-8af1-31fe148e3663	6286ee12-aa18-4fd7-aef8-a440f2f2a6f3	c8255c02629a1423d59aee0ae1a22ace03025d373112805a5a93ac3cbe5aaed0	2026-10-19 00:30:39.466+03	2026-10-12 00:30:39.467+03	2026-10-12 00:30:49.063+03	5d3fbb71-0991-4409-8399-c5e13ed58f82
98a458d0-d53f-427d-8fa3-9ded4210e0c5	fc994aed-7116-45e7-8f9a-c82fb0176a25	e00b183dc0fc0002d0c99a1ef0ad48909cd106130a5df18c00346cf24dd9c8a4	2026-10-19 11:56:25.991+03	2026-10-12 11:56:25.997+03	\N	\N
127ac02d-2fa8-4711-96a1-1907b8f80937	7745db1a-5cb3-407a-a848-40fc17822e26	69b9c0594a04dd8daa42f11bc107cfaaf5c4f388f1891d8121a71fd1c9a932b8	2026-10-19 11:56:38.474+03	2026-10-12 11:56:38.48+03	2026-10-12 12:00:45.593+03	10ec01d7-57dd-485f-a066-55e0ce67a198
10ec01d7-57dd-485f-a066-55e0ce67a198	7745db1a-5cb3-407a-a848-40fc17822e26	7da6094742934229b4b8109a4848f3b497a038e0c10b09aec0d4de1ddbfc2873	2026-10-19 12:00:45.594+03	2026-10-12 12:00:45.601+03	2026-10-12 12:29:35.622+03	ab49f9c8-4fea-488d-8970-ff195eb1ea48
ab49f9c8-4fea-488d-8970-ff195eb1ea48	7745db1a-5cb3-407a-a848-40fc17822e26	01ff762aeeb36fb33ed1ce410740d163fc8d9175d483a3e0097d5704ca5d7155	2026-10-19 12:29:35.622+03	2026-10-12 12:29:35.624+03	2026-10-12 12:38:01.848+03	157ce998-bd35-4bd6-953e-c6277e44d9b3
157ce998-bd35-4bd6-953e-c6277e44d9b3	7745db1a-5cb3-407a-a848-40fc17822e26	09600fda23c3daf0d41aabd014058bd3f76c58736bbc900da08cb732ce430a28	2026-10-19 12:38:01.848+03	2026-10-12 12:38:01.85+03	2026-10-12 13:19:57.124+03	321c653d-db2a-4709-8111-fdce111eaa3b
321c653d-db2a-4709-8111-fdce111eaa3b	7745db1a-5cb3-407a-a848-40fc17822e26	5078b7e958966899de8fb9b9b59fb2da8099afe942eacbabf7f7054516423a91	2026-10-19 13:19:57.124+03	2026-10-12 13:19:57.125+03	2026-10-12 13:20:26.156+03	5c16a48d-47fb-4fd5-a599-604d00afe2a3
5c16a48d-47fb-4fd5-a599-604d00afe2a3	7745db1a-5cb3-407a-a848-40fc17822e26	f19a9d8abe13439f29826a6647a057587adca731937f11a19f514db6d37a762c	2026-10-19 13:20:26.156+03	2026-10-12 13:20:26.157+03	2026-10-12 13:20:50.55+03	8d7c3722-ecb7-4403-b01b-ad8e134e9fe9
8d7c3722-ecb7-4403-b01b-ad8e134e9fe9	7745db1a-5cb3-407a-a848-40fc17822e26	90e63e7b5647145838e275e7dd191f81abc6abe4e4f96d1413446872a5730bc5	2026-10-19 13:20:50.55+03	2026-10-12 13:20:50.552+03	2026-10-12 13:22:31.687+03	6ad2288d-0aa5-4be2-9856-62c19e1d6f16
6ad2288d-0aa5-4be2-9856-62c19e1d6f16	7745db1a-5cb3-407a-a848-40fc17822e26	c7fd82c20add1b156a1408fde249b9064d65688a964daff8f2ec8a1b10819f4f	2026-10-19 13:22:31.687+03	2026-10-12 13:22:31.689+03	2026-10-12 13:24:57.546+03	aaf2a180-90d2-47c8-9079-4668e489cdd5
aaf2a180-90d2-47c8-9079-4668e489cdd5	7745db1a-5cb3-407a-a848-40fc17822e26	af851eaf4a558c3c9f3d1df575a8ba36f61f79fd1f7178534b45fcf5c9941e0f	2026-10-19 13:24:57.547+03	2026-10-12 13:24:57.548+03	2026-10-12 13:34:21.126+03	e208f9d0-5454-440d-bfeb-ac63c254cddd
e208f9d0-5454-440d-bfeb-ac63c254cddd	7745db1a-5cb3-407a-a848-40fc17822e26	f66273bccb77db6c7a6ce4110f0fa8d50ac70ef37af3087491a4e5f2d1ecedb2	2026-10-19 13:34:21.126+03	2026-10-12 13:34:21.128+03	2026-10-12 13:34:50.367+03	7c3f03a0-161b-40d0-a4c1-884a1268ae76
c3467c17-2070-497b-8043-761ecb5f35d5	7745db1a-5cb3-407a-a848-40fc17822e26	d568836ddb1f5e05b8416cbffe0178ff138f63c48e1421b454fbc7e02bd41d41	2026-10-19 13:34:57.819+03	2026-10-12 13:34:57.82+03	\N	\N
7c3f03a0-161b-40d0-a4c1-884a1268ae76	7745db1a-5cb3-407a-a848-40fc17822e26	23de68486336e75fe79c18541c9b98fd354ab090f9e3e9276cf305c42abeea76	2026-10-19 13:34:50.367+03	2026-10-12 13:34:50.369+03	2026-10-12 13:34:57.819+03	c3467c17-2070-497b-8043-761ecb5f35d5
da4e80a5-f296-46dc-a1d3-c0adfd1ac1e9	13ecb651-e694-42c1-a172-38f9f0d4c6d3	4f50e2ceb6df25a11df3f5a6c5d7648fd58506726562e1f4a6f927153702413a	2026-10-19 13:45:20.372+03	2026-10-12 13:45:20.373+03	\N	\N
f2b7d25d-58b5-42ed-99fe-aae347744e81	6538a876-d86b-4a77-9021-3dca20e63734	271b4d9a3275a8e7488bce17c532f5ee96c4f07cf689c7ef3ccb302f6139a8bc	2026-10-19 13:45:20.925+03	2026-10-12 13:45:20.926+03	\N	\N
90978b15-e59e-4add-bb5f-ca3bc54c4903	9a69d730-8085-407b-a1df-c34a6b08069a	3ea828c93603d50230d78d5fd4d7942b534a83d3adcf540d4709c120c47e4cc8	2026-10-19 14:25:07.241+03	2026-10-12 14:25:07.242+03	\N	\N
77a96a5c-1b1b-43c8-a55c-1d95ffd1f39e	51714ba5-3c4f-4538-a6ed-e00d5a455ca4	86ff44253ab2283a34525d1198d4ae6ac6cc91b6f409dba1686225efc5803be2	2026-10-19 14:25:08.117+03	2026-10-12 14:25:08.118+03	\N	\N
a2a57c5d-f4e4-40fc-b9ac-3283026f88c9	028084fe-24b4-43f8-8b84-493cb4f380e6	db945475ac41f78cc93c8da042f4ea81f6917d57da2b5b88d941f7f6ac408817	2026-10-19 14:25:38.465+03	2026-10-12 14:25:38.466+03	\N	\N
925fb055-ef62-4b3f-aeff-4d102db53626	4d283b71-2922-41a4-9ca2-7fc06b46cc21	65388e92be4ceb13a8ff388338f0a8aa434a6615fdc2f35b62a7b11750931038	2026-10-19 14:25:49.686+03	2026-10-12 14:25:49.687+03	2026-10-12 14:31:49.895+03	d2a22b75-5b4f-4c95-834c-cbf4753f5c76
b2cf6f2a-2873-4ca3-9fa2-9de5159a4f40	4d283b71-2922-41a4-9ca2-7fc06b46cc21	6997c9be3dbf16aa44803dfa9c936085827ab9d8b77bd6e7541b5fd344640956	2026-10-19 14:34:01.032+03	2026-10-12 14:34:01.034+03	\N	\N
d2a22b75-5b4f-4c95-834c-cbf4753f5c76	4d283b71-2922-41a4-9ca2-7fc06b46cc21	8febc596690ef75c5eae8a194ab4257fbca885e8c27b552574e4e06660705c76	2026-10-19 14:31:49.895+03	2026-10-12 14:31:49.896+03	2026-10-12 14:34:01.032+03	b2cf6f2a-2873-4ca3-9fa2-9de5159a4f40
7a8d259d-7e60-4092-bc1f-bca6b15c33ac	2ebd2973-a219-483b-a9b7-5e58de1bc9d5	9347acef61f64bbae0deab78aabe015bed053fceb540d4b8973958889b2acf88	2026-10-19 14:35:05.764+03	2026-10-12 14:35:05.767+03	2026-10-12 14:35:12.767+03	b495fc9a-8fd5-4f93-b83f-54c5f4ca63c9
b495fc9a-8fd5-4f93-b83f-54c5f4ca63c9	2ebd2973-a219-483b-a9b7-5e58de1bc9d5	26f828e1a6a8253285d16cb66a645c72ed075aa278a1df231e742465de4f6e53	2026-10-19 14:35:12.767+03	2026-10-12 14:35:12.77+03	2026-10-12 14:43:37.721+03	89d1cad0-491e-4e5a-a635-9ab278a88ee4
5da2a68b-62a8-4ddf-8106-b47ee7742483	2ebd2973-a219-483b-a9b7-5e58de1bc9d5	4dcd5390be96930572ce0905726d5d935b25e8229ac89f2e0e73c9089df9bbf6	2026-10-19 15:04:32.647+03	2026-10-12 15:04:32.649+03	\N	\N
89d1cad0-491e-4e5a-a635-9ab278a88ee4	2ebd2973-a219-483b-a9b7-5e58de1bc9d5	44b86ef2035c5649377038a5a5dd333a609951e47e2eeadcf9d931de1c19917e	2026-10-19 14:43:37.722+03	2026-10-12 14:43:37.724+03	2026-10-12 15:04:32.647+03	5da2a68b-62a8-4ddf-8106-b47ee7742483
0200bef6-1604-46ca-b1a0-8bb4f2c212a3	929bd570-5f2a-48d2-9d50-70b0ea89e425	04a5755a7001af9e482f4d528a4205de3f4492c5c02b9d31147d449f9a878af5	2026-10-19 15:05:13.788+03	2026-10-12 15:05:13.789+03	\N	\N
bd906cee-69cc-4d96-ab66-e0709d5d4d2e	2dcb2be6-5d43-47f4-835c-e7fd3cd6f377	18e9baba50e19f945003b375b2cde5becdcf6d237a9212b6892725e58b7e41ac	2026-10-19 15:15:40.028+03	2026-10-12 15:15:40.029+03	\N	\N
925c7392-72d2-42cc-9954-177b45d2a351	0d0e665f-6767-4a1e-a55b-5f271cfa7c11	05f5805cce3f8dc4d4d8103cc6a1024306d76c33c2d0ca4300ef2b07f5dd1720	2026-10-19 15:19:49.719+03	2026-10-12 15:19:49.719+03	\N	\N
0c448975-6d38-44f4-b489-368fe415b954	d0f152f9-2773-4e0e-98e6-81cabcb65cdb	4e9a1597a031f0f98d9d431eef61cd36a1d61ef23ee06e9719fb23c7805fa16f	2026-10-19 15:19:58.034+03	2026-10-12 15:19:58.035+03	\N	\N
218cb0dc-4078-4e50-9d1a-0cdc6a322519	d5f14cbb-ed0e-462f-9bec-aea0126ccda2	4a519f8d0cc6570330a0717852a1c75c934e42f22b2c25bb726ac8da7c78b101	2026-10-19 15:20:15.327+03	2026-10-12 15:20:15.328+03	\N	\N
47817b53-92a1-48f0-b790-3858d85eddf4	8613478c-983c-4924-b10c-86ab081dc6de	f2bedbe29f1036b6d52cfdbce2713850f0a3a0d29843c11f582297a9d30170d2	2026-10-19 15:21:48.112+03	2026-10-12 15:21:48.113+03	\N	\N
85919d0b-677c-41df-85d6-69667dd4a387	81d87c15-4543-493a-9f0a-094601b20710	33aaaf9da6ee7bbf77dc7dde3f20d05ac6c14acc57a4d12360b2eed464d9683d	2026-10-19 15:28:33.631+03	2026-10-12 15:28:33.632+03	\N	\N
0d319712-f803-42aa-8d24-cb3fdd00d8f2	ac0b21be-fb1e-4a13-8587-ce33cdd42843	65e1ea370b5ba9de1b3fb11811ede2538b04e7fc4124715c07a81365ed3e83db	2026-10-19 15:16:23.069+03	2026-10-12 15:16:23.07+03	2026-10-12 15:29:37.652+03	3d9cdc41-110a-4ee6-bb3a-763f1bf6ecd8
3d9cdc41-110a-4ee6-bb3a-763f1bf6ecd8	ac0b21be-fb1e-4a13-8587-ce33cdd42843	b66f0b4c1fb490bcda693a4c8081fe046b2d732df9c44b9516e36d95e304e887	2026-10-19 15:29:37.652+03	2026-10-12 15:29:37.656+03	2026-10-12 15:29:44.144+03	2ff0ac1a-9c8b-42c7-97b0-a7c779a75065
2ff0ac1a-9c8b-42c7-97b0-a7c779a75065	ac0b21be-fb1e-4a13-8587-ce33cdd42843	df77648ed00dd013d06e851f18ae9021b82b86eb0bb6dffd1ad2745e293caeb8	2026-10-19 15:29:44.144+03	2026-10-12 15:29:44.147+03	2026-10-12 15:29:52.913+03	8c8b887e-6a53-47e7-9588-f7aabc68e7a9
8c8b887e-6a53-47e7-9588-f7aabc68e7a9	ac0b21be-fb1e-4a13-8587-ce33cdd42843	7b31f6251e4cfb965f623586e457fe50dd4fb6b98416357b8cde0eb403108359	2026-10-19 15:29:52.913+03	2026-10-12 15:29:52.916+03	2026-10-12 15:29:59.895+03	1772ab80-5c54-4605-8d1a-e655ccd6fa3d
a56f7d8a-5f2c-4b6a-a756-49adab829e1a	ac0b21be-fb1e-4a13-8587-ce33cdd42843	7daaae5a34bd012bdb37716615bdc82cf1a1ab0243f73e6c34099790c554c067	2026-10-19 15:30:08.148+03	2026-10-12 15:30:08.15+03	\N	\N
1772ab80-5c54-4605-8d1a-e655ccd6fa3d	ac0b21be-fb1e-4a13-8587-ce33cdd42843	95e1ccc685d4b01b992166476242dfdc405e84a9c6ccd4eb9a6a638443b52dbf	2026-10-19 15:29:59.895+03	2026-10-12 15:29:59.898+03	2026-10-12 15:30:08.148+03	a56f7d8a-5f2c-4b6a-a756-49adab829e1a
42c98a84-31b2-40bf-ac47-d87cba95c251	297f24e5-1de9-4d54-a802-5b5df75575e9	9a0eff23766e60a0da6f4181ad533846c6866574c204d12e1386535b8e29e433	2026-10-19 15:31:08.288+03	2026-10-12 15:31:08.29+03	\N	\N
32ef025f-7dda-4498-8723-8635ea49d943	892bd3b4-93f0-4502-a222-d88f8308d0ad	79cf223035a4b8e1012471c5fca3757927af4ffcea5d03a6f114f3f97f3844f9	2026-10-19 15:39:19.423+03	2026-10-12 15:39:19.424+03	\N	\N
4c575343-d00a-4ef6-bba2-74b6de0b9b5d	46414bc7-c857-4480-be24-2efe5faf11d6	0bf016f5b5e16263db93f1e77bf08d85b8e06ab3363a0ba17e3e308195414170	2026-10-19 15:39:30.777+03	2026-10-12 15:39:30.778+03	\N	\N
641339ea-09f2-4927-8255-4fefc8497ed2	5560a253-f710-4e10-81d6-e84e49f024b6	4e50f1171ae67570e22a84e3a5ae987ba7053dac7a376c9e4b27b9cfba8d8372	2026-10-19 15:40:01.826+03	2026-10-12 15:40:01.827+03	\N	\N
c38146d2-b394-44da-b399-0f45c8b5c220	4ad34046-c1f7-4827-8d89-ff3593fefa63	8825bda9504bef58edbedaccf4a48df134d912bc77c2247d2bdaf9cbb37e602b	2026-10-19 15:40:13.28+03	2026-10-12 15:40:13.281+03	\N	\N
93e40ee0-1c63-4c70-bcf7-e69f7a5adaa1	47051f1f-e2e5-435f-a194-d8ef90906c87	60c62d12fe9b40110e947d2b192cf35ca47e46ba8ba22f976afcfe1161699a89	2026-10-19 15:40:23.169+03	2026-10-12 15:40:23.17+03	\N	\N
ca7b53a1-b242-4c4b-b1d0-36efe3dabe81	f84d597a-4797-4103-9b7f-4e44801eb5c8	aac0eb5b7abd3b572c418cbecd6cffc4083949a4bf32d75b65e58a7b8d9def62	2026-10-19 15:40:34.34+03	2026-10-12 15:40:34.341+03	\N	\N
563b2559-1af9-4402-80f3-a8df39659309	53ce01fb-dae5-465a-961c-7abfc1d4994c	2bb5050c66053e9a47d819a9ab84daa19ec31f8b9a4c0adfd7aeb703d2d89bb5	2026-10-19 16:01:02.263+03	2026-10-12 16:01:02.265+03	2026-10-12 16:11:45.479+03	2ee01f15-208a-4adb-87d9-7552b3833493
42bba35b-614e-4fc3-bc93-020d11db2cf7	53ce01fb-dae5-465a-961c-7abfc1d4994c	f2d7655eedded9969bc6b83a3b3eb84ef486db0fe3598bdfdb1fe34c73f48adf	2026-10-19 16:30:04.823+03	2026-10-12 16:30:04.827+03	\N	\N
2ee01f15-208a-4adb-87d9-7552b3833493	53ce01fb-dae5-465a-961c-7abfc1d4994c	90472ac127d42b4e8cbb0e46586761da4a5660076d5f6e544d2acb7be9e96708	2026-10-19 16:11:45.479+03	2026-10-12 16:11:45.482+03	2026-10-12 16:30:04.823+03	42bba35b-614e-4fc3-bc93-020d11db2cf7
5821462f-07b4-46b6-a2bc-2140c515fff3	da72f9a0-2f03-4bec-a3e9-b5c45e270ba4	009a45c9cebb61c1925341043e90319dcb543843b2cee1e5428440633c652779	2026-10-19 16:30:11.17+03	2026-10-12 16:30:11.171+03	\N	\N
e73404cb-039e-4e11-a2c5-e1e28d8f1a0f	822e3883-3ba4-4a5f-a831-1d8a9dac25a5	28ecaf6cd306585e850c3e1b7bec183b275e3e06df0923841a9987d97b9fe0a2	2026-10-19 16:30:19.193+03	2026-10-12 16:30:19.194+03	2026-10-12 16:32:33.976+03	ed82e1dc-2b2c-496e-b329-8acf705dafa9
ed82e1dc-2b2c-496e-b329-8acf705dafa9	822e3883-3ba4-4a5f-a831-1d8a9dac25a5	cf8903990deab5b8bc6d019b3757add185a35daf04ad49aa38da3b7d75e903d0	2026-10-19 16:32:33.976+03	2026-10-12 16:32:33.979+03	2026-10-12 16:32:50.587+03	ec6c7483-4aed-486f-83ef-843f34506191
ec6c7483-4aed-486f-83ef-843f34506191	822e3883-3ba4-4a5f-a831-1d8a9dac25a5	e17277fe78fe4b3260f7cafe4f3c0b5cae8f0c4961125a2122c5fc40925fd97d	2026-10-19 16:32:50.587+03	2026-10-12 16:32:50.589+03	2026-10-12 16:33:07.87+03	069ecd80-ad4b-4afd-921b-7cff2c74ebe8
069ecd80-ad4b-4afd-921b-7cff2c74ebe8	822e3883-3ba4-4a5f-a831-1d8a9dac25a5	64cee10bd59854b1ba7ff6342edf3e439f727e93f92d71f1d300f4213885eb2e	2026-10-19 16:33:07.87+03	2026-10-12 16:33:07.874+03	2026-10-12 16:33:33.323+03	fbe4fac8-8a44-4b87-bfca-2926ac0b54f8
fbe4fac8-8a44-4b87-bfca-2926ac0b54f8	822e3883-3ba4-4a5f-a831-1d8a9dac25a5	aad3278021fe3e05b9d1580ed34d56306ec6fbb0087ffc373545681667a57b92	2026-10-19 16:33:33.323+03	2026-10-12 16:33:33.327+03	2026-10-12 16:33:46.866+03	7503573e-5fc7-45f0-bae4-69cb5a36388e
7503573e-5fc7-45f0-bae4-69cb5a36388e	822e3883-3ba4-4a5f-a831-1d8a9dac25a5	40b3d661a9a26dd5ee03827dab27d76394d67c417fce5246986d6df674ed397c	2026-10-19 16:33:46.866+03	2026-10-12 16:33:46.87+03	2026-10-12 16:36:38.005+03	758a85e4-7f32-41cd-95ee-c4c983dd8c37
758a85e4-7f32-41cd-95ee-c4c983dd8c37	822e3883-3ba4-4a5f-a831-1d8a9dac25a5	816b66d4193e4b5542954bb8b9deab084164a1532dc08262f5ec31f222e00d98	2026-10-19 16:36:38.006+03	2026-10-12 16:36:38.009+03	2026-10-12 16:43:53.96+03	dba0f4ac-3196-48eb-9f53-efdce17ad15a
dba0f4ac-3196-48eb-9f53-efdce17ad15a	822e3883-3ba4-4a5f-a831-1d8a9dac25a5	c4d3e2181f7e3ec55b9a1e777a09be387d34fc61afba5ef7e73fba426eedf61b	2026-10-19 16:43:53.96+03	2026-10-12 16:43:53.973+03	2026-10-12 16:45:31.672+03	55cf2792-53a8-48b2-9b0e-f381beb66604
55cf2792-53a8-48b2-9b0e-f381beb66604	822e3883-3ba4-4a5f-a831-1d8a9dac25a5	c80147797cbcd20bea3b561eb8934e23cb6ffa3456fcf8855211536e410e7b6e	2026-10-19 16:45:31.672+03	2026-10-12 16:45:31.673+03	2026-10-12 17:15:43.377+03	b45f6cae-3a9b-4c1b-9f9e-80ded290b589
b45f6cae-3a9b-4c1b-9f9e-80ded290b589	822e3883-3ba4-4a5f-a831-1d8a9dac25a5	fab4a37624a05b8516528aa4a51e206d1f5d0b17513de0e6058c88ef60c17517	2026-10-19 17:15:43.377+03	2026-10-12 17:15:43.38+03	2026-10-12 17:15:54.432+03	94637e85-b6af-4c7a-ae4f-25c6f066a497
94637e85-b6af-4c7a-ae4f-25c6f066a497	822e3883-3ba4-4a5f-a831-1d8a9dac25a5	631de702005c377fc90366d8e9e1f7c037f6ffb7aae393c92f057896babf2301	2026-10-19 17:15:54.432+03	2026-10-12 17:15:54.434+03	2026-10-12 17:16:51.635+03	db7fc613-0431-41c3-bdcb-5a4d074c35df
db7fc613-0431-41c3-bdcb-5a4d074c35df	822e3883-3ba4-4a5f-a831-1d8a9dac25a5	c331519d6038fd29005e54bdf52693dfc9f75d2ab857bd0e11cd4867422ea274	2026-10-19 17:16:51.635+03	2026-10-12 17:16:51.636+03	2026-10-12 17:16:57.418+03	fafb75e4-b2ee-4f53-85a5-5e6a3da1da12
5c7d2b90-30c5-4fef-91ea-8f14136dc293	822e3883-3ba4-4a5f-a831-1d8a9dac25a5	827368534c55532927772a614d57aa47ca46ad4c92e2fffa8bc19739573c824a	2026-10-19 17:17:01.666+03	2026-10-12 17:17:01.667+03	2026-10-12 17:18:29.39+03	f63c8e61-de48-4748-bdb6-90069074cf59
fafb75e4-b2ee-4f53-85a5-5e6a3da1da12	822e3883-3ba4-4a5f-a831-1d8a9dac25a5	268107f7b8d5636b4731044f76deafd68a6a4979e6f466e54189983d454e09a6	2026-10-19 17:16:57.418+03	2026-10-12 17:16:57.42+03	2026-10-12 17:17:01.666+03	5c7d2b90-30c5-4fef-91ea-8f14136dc293
f63c8e61-de48-4748-bdb6-90069074cf59	822e3883-3ba4-4a5f-a831-1d8a9dac25a5	73ecc5d29ac5ba1e5e1f424decb05c24679a0d788ed8eb5c93c65df5403ec632	2026-10-19 17:18:29.39+03	2026-10-12 17:18:29.392+03	2026-10-12 17:18:36.656+03	6621b348-b0e9-467e-bddd-1eff6d6106c8
2e15bd0c-e597-43c0-ac5e-632d523f0a6c	0466dd10-9947-4c44-b2ec-8dd5ba0756cf	eecc31def971bb8f9b0d7b695861503636da077e38aac3281d0145486a62cfd1	2026-10-19 17:25:11.016+03	2026-10-12 17:25:11.021+03	\N	\N
6621b348-b0e9-467e-bddd-1eff6d6106c8	822e3883-3ba4-4a5f-a831-1d8a9dac25a5	03161535a40962a77c478e2f370e06878732883b1f843a7b9c0e54eb73e0b407	2026-10-19 17:18:36.656+03	2026-10-12 17:18:36.658+03	2026-10-13 14:31:12.567+03	e80f38a1-6802-457a-b77c-45096dccd6be
c396932f-274b-4b13-97e0-1738df95b05d	822e3883-3ba4-4a5f-a831-1d8a9dac25a5	23c59e3bf80bcc8ed1fa26f7beeea72552e851054ebbb5be32ea898e259a9d8c	2026-10-20 14:31:18.859+03	2026-10-13 14:31:18.861+03	\N	\N
e80f38a1-6802-457a-b77c-45096dccd6be	822e3883-3ba4-4a5f-a831-1d8a9dac25a5	ffbc7193a2f4403c0bb8df1aba12c6771bc2a2a64c9a343bbf1ca21da5ab976c	2026-10-20 14:31:12.567+03	2026-10-13 14:31:12.568+03	2026-10-13 14:31:18.859+03	c396932f-274b-4b13-97e0-1738df95b05d
5d61e69d-99b4-4293-bc5c-14f9df12ec9b	bb507bee-f76d-4b6a-8fa2-89dd6696438e	8672ce3bc4370fead073fbdfc41b12a3aff7a80fe7dafa5291c3e4dcba617adc	2026-10-20 14:31:36.433+03	2026-10-13 14:31:36.435+03	\N	\N
bb68c9c8-7faa-4c9a-8841-463a51525ffa	63fc48b8-c187-4557-ab52-52729bc16cd7	990cb0941e19ac84309e7cf52ea732ebc7691857324eae6325e23e56cbc44ef2	2026-10-20 14:33:26.511+03	2026-10-13 14:33:26.512+03	2026-10-13 14:34:40.275+03	31a831f4-fbab-411a-a02d-f292b564d1fe
31a831f4-fbab-411a-a02d-f292b564d1fe	63fc48b8-c187-4557-ab52-52729bc16cd7	1f24a880268b55fa143b1f23b254b5ef650aa4b80e9e62dae48b8791bc0584ef	2026-10-20 14:34:40.275+03	2026-10-13 14:34:40.277+03	2026-10-13 14:38:17.282+03	6ea8d5b6-985b-45d4-b684-9f9131fc17c1
6ea8d5b6-985b-45d4-b684-9f9131fc17c1	63fc48b8-c187-4557-ab52-52729bc16cd7	f819c361336a6f6197b51bd8df3cd7ec511daedf5126c5f0a567cc63b5c9ed39	2026-10-20 14:38:17.282+03	2026-10-13 14:38:17.284+03	2026-10-13 14:38:51.089+03	d5359ab6-2372-46ec-8b11-d5fb4e6f892f
d5359ab6-2372-46ec-8b11-d5fb4e6f892f	63fc48b8-c187-4557-ab52-52729bc16cd7	c1f0948fe8e918e59ec589c3f01d7118027de9f3ddac5cf8f1d5e2660a51a968	2026-10-20 14:38:51.089+03	2026-10-13 14:38:51.09+03	2026-10-13 14:38:59.313+03	6b556462-6e64-4280-ae46-3f7f9b5945e0
6b556462-6e64-4280-ae46-3f7f9b5945e0	63fc48b8-c187-4557-ab52-52729bc16cd7	0efab37aae4e310059a226c830641eced2233613ec23ac3aea7a53d3197d1d69	2026-10-20 14:38:59.313+03	2026-10-13 14:38:59.315+03	2026-10-13 14:39:47.141+03	67cb0b10-a72d-40f5-aec6-251d4b7bfd22
67cb0b10-a72d-40f5-aec6-251d4b7bfd22	63fc48b8-c187-4557-ab52-52729bc16cd7	99d38d959209267860f3c6f00d6f0e606291596ab101805a5e3223886b800138	2026-10-20 14:39:47.141+03	2026-10-13 14:39:47.144+03	2026-10-13 14:40:03.521+03	619efd50-0e88-4f70-882b-88e4f084533e
619efd50-0e88-4f70-882b-88e4f084533e	63fc48b8-c187-4557-ab52-52729bc16cd7	f4ebc51a06f6f734c220e9e56acbdd956cabceae41af18816ca144a1b378cb91	2026-10-20 14:40:03.521+03	2026-10-13 14:40:03.522+03	2026-10-13 14:40:12.579+03	df65c509-a112-4262-91a5-3e1039e49230
df65c509-a112-4262-91a5-3e1039e49230	63fc48b8-c187-4557-ab52-52729bc16cd7	8f79e1e658a768b6f6a163c0851c3aa6ab58bf30a6618b98bf7cb33e6aed1ca5	2026-10-20 14:40:12.579+03	2026-10-13 14:40:12.581+03	2026-10-13 14:41:40.762+03	19c13ee7-8ddb-4b9e-9d3e-1205f9bc0a1f
19c13ee7-8ddb-4b9e-9d3e-1205f9bc0a1f	63fc48b8-c187-4557-ab52-52729bc16cd7	d3ca66f767ce4c3b918d8ccbae165d419be74c23f3eece5af1cd9dbc6b7b20d4	2026-10-20 14:41:40.762+03	2026-10-13 14:41:40.765+03	2026-10-13 14:42:18.007+03	bb2aa70f-27e9-4e8f-a03a-0c6791cbdee7
bb2aa70f-27e9-4e8f-a03a-0c6791cbdee7	63fc48b8-c187-4557-ab52-52729bc16cd7	43db1a949f7149f46afebc891a692636978d95b8268f5418b6ed3ae751c74635	2026-10-20 14:42:18.007+03	2026-10-13 14:42:18.008+03	2026-10-13 14:44:14.687+03	5d528958-1048-42f6-b442-cbbb2ea2a31c
5d528958-1048-42f6-b442-cbbb2ea2a31c	63fc48b8-c187-4557-ab52-52729bc16cd7	25ddda999c13953a662ac27ae2a5aff41c15dba318bcbc4662638c776fac7eff	2026-10-20 14:44:14.687+03	2026-10-13 14:44:14.688+03	2026-10-13 14:46:52.567+03	75a02069-0fec-42b7-a378-4b54cff067a4
05d8dabf-dc46-4886-a7e1-52ec72ef82ec	63fc48b8-c187-4557-ab52-52729bc16cd7	c8eecc74bfc8111ff15e1fa57e36bb25f1f8cea9bc2c5ab877f131115240d7e4	2026-10-20 14:46:55.11+03	2026-10-13 14:46:55.117+03	\N	\N
75a02069-0fec-42b7-a378-4b54cff067a4	63fc48b8-c187-4557-ab52-52729bc16cd7	2d793ab1ae40ea5bed84e4504258c2a2c376e8dd4ee76d12d2a3e67eb6803dfb	2026-10-20 14:46:52.567+03	2026-10-13 14:46:52.576+03	2026-10-13 14:46:55.11+03	05d8dabf-dc46-4886-a7e1-52ec72ef82ec
239ed6bd-fad0-4376-8b9f-3e00f0af7cca	cb9140e7-ab26-4f9d-a395-ae4b6fcf2f7b	df0ed69a34b42e42953ff2734ea4a360df5c17c777b6103fb5d184e694f79959	2026-10-20 14:47:55.063+03	2026-10-13 14:47:55.065+03	\N	\N
599e01a4-cc97-4269-8759-0cca2a0c9d29	55c1c20c-a1c0-4c15-8e7c-c7da588298be	68d395fffc41a52e96b871d705c055750c38ebfe37212befb835698ab3924108	2026-10-20 14:48:26.915+03	2026-10-13 14:48:26.916+03	2026-10-13 14:49:16.058+03	271a941a-c71f-4876-bb3a-0d648d541562
70dcd060-f406-4c28-88ef-0ad370a36ee7	55c1c20c-a1c0-4c15-8e7c-c7da588298be	46a20d9ef9f08876bb5a508de1c87f9b701955d3474a10c41ae61e395c8836dc	2026-10-20 14:50:00.412+03	2026-10-13 14:50:00.415+03	\N	\N
271a941a-c71f-4876-bb3a-0d648d541562	55c1c20c-a1c0-4c15-8e7c-c7da588298be	aae40b918506c10d97834e5be3e787f8a8986047a97ddac2c3f77f6343e7ff07	2026-10-20 14:49:16.065+03	2026-10-13 14:49:16.094+03	2026-10-13 14:50:00.412+03	70dcd060-f406-4c28-88ef-0ad370a36ee7
a2372681-60f2-44fa-9812-6dc843ce12d9	dc51b01c-6514-4d84-b8d3-c1c07eb4f8a4	235a882362e9113d1a63416cbcf2324d96b2b84800f79aeb83af978955415399	2026-10-20 15:01:14.893+03	2026-10-13 15:01:14.894+03	\N	\N
4572bc5d-1abe-46d1-9ba0-e42a6ca0461e	a7aa14e1-eeb8-4cd2-be06-7b71074914e7	eee532217a7add590c4429230cc703579a1b81110d3d0f99cd1c6189c8018e05	2026-10-20 15:22:25.132+03	2026-10-13 15:22:25.142+03	\N	\N
6c77503b-0229-44d0-80ff-237279dd264f	a7aa14e1-eeb8-4cd2-be06-7b71074914e7	2ff36d9a38f18d56afabce19c8fa9adf76fc1dfe0af9ca90a02fa66b4368f1ca	2026-10-20 15:03:39.836+03	2026-10-13 15:03:39.837+03	2026-10-13 15:22:25.132+03	4572bc5d-1abe-46d1-9ba0-e42a6ca0461e
f7687d0d-5ecc-40d0-b95b-3a0c0fa61787	3dadfff0-df8d-46b6-aa9e-a49ebce008b8	0e30d87b65e52daa38c25650af6a1d7a07bfc66d5e2b8ed9d142309d39c99747	2026-10-20 15:23:59.844+03	2026-10-13 15:23:59.846+03	\N	\N
3f0d9d1c-e4c9-4a44-adca-892abc689cb8	3dadfff0-df8d-46b6-aa9e-a49ebce008b8	24e9d19049e13910c9788e105a77afebf2d34bcece68c55f4ed8d96d528e74f6	2026-10-20 15:22:34.057+03	2026-10-13 15:22:34.065+03	2026-10-13 15:23:59.844+03	f7687d0d-5ecc-40d0-b95b-3a0c0fa61787
dcb38069-1acd-4cc5-b84b-23efb938fcf4	0c527439-5ef1-4fe4-996d-3acebdf4daa6	6ad3a6a4f4f28965677eb9f27f8bb0e55162e59f0cb68c72cbe898d4c4359e24	2026-10-20 15:25:20.199+03	2026-10-13 15:25:20.2+03	\N	\N
566ad60c-7938-41c7-97aa-2f82b4af8860	d399af64-3411-4bed-a235-f1471b23f59f	16b028346b1c86b1e74c78b42caeffb8ffb01bb1e0eeb7fad7c5463a7abe1dc1	2026-10-20 15:28:17.055+03	2026-10-13 15:28:17.057+03	\N	\N
403e7324-cb52-4cae-936c-6de69d598690	fdaf3074-a268-45fa-8845-32389d5a485d	a534c26b6f7e8fa7c091a7121a40a7e1b356564d5cc5f1db0beb96059156613a	2026-10-20 15:28:32.938+03	2026-10-13 15:28:32.939+03	\N	\N
a2a109fb-9cac-4e01-a291-7ebae3f324fd	e2aec66d-10b5-4536-82c1-9c733a145f42	bb24665ba2f6e68515784e864fd7226d3d00e164bb4314af64102ae9a1e4b724	2026-10-20 15:34:00.593+03	2026-10-13 15:34:00.594+03	\N	\N
e4f7f10a-530d-4013-acc7-9d9c570ca84a	07492bf3-86cb-4e0e-bda1-98a29452b43e	7d3e9da4d55042e2ae3a5f479525fd4005a0c54e988e2dbb2cfe9db5ee348e1b	2026-10-20 15:37:38.308+03	2026-10-13 15:37:38.309+03	2026-10-13 15:55:42.628+03	959599ed-8753-420c-b64c-237233935a86
bc28ca58-b867-4a93-a7f4-f188cba81782	07492bf3-86cb-4e0e-bda1-98a29452b43e	e3bd3388dc1c1a6038e8b6ae76bd90f29ac627ec19c365f780d1893b11d8653a	2026-10-20 15:57:21.935+03	2026-10-13 15:57:21.937+03	\N	\N
959599ed-8753-420c-b64c-237233935a86	07492bf3-86cb-4e0e-bda1-98a29452b43e	ced80c7a345c92959821ad08fea82ca58665788d9b75f8652a29d18790713cef	2026-10-20 15:55:42.628+03	2026-10-13 15:55:42.63+03	2026-10-13 15:57:21.935+03	bc28ca58-b867-4a93-a7f4-f188cba81782
db9fa2b5-902c-42d1-8425-1c15e4653475	f463fcfd-a06f-441c-ba95-5ddb54fca08a	aaf5de27bdb061ab0b76d2b7b9794cfa7158494220fe05dbeac6772b01152012	2026-10-20 15:58:32.171+03	2026-10-13 15:58:32.172+03	\N	\N
437382da-8fe9-4c5c-906b-5ce9b77570a9	c863caa2-e6fa-4f69-a685-d0616cd49627	0210e46a3f1250bd49783c2147e678e6345834bce273ea815ffa9a0be973dda3	2026-10-20 16:00:38.529+03	2026-10-13 16:00:38.53+03	\N	\N
1ae0628f-ef41-45a9-9140-6ea756b5e32b	da314fa6-ff9d-4566-b28d-4a52fd3f623a	e1699b812f34d72c5a907865bedd2996b7954d96504b99fc1e5e00b639a481fc	2026-10-20 16:01:23.618+03	2026-10-13 16:01:23.619+03	\N	\N
1f3d07f1-4937-458e-b355-12a8a116f4f4	7e60fa77-c1d8-4204-b158-1c31dd1f6ad5	8a0add91d3bae3c6f1fcf5d478a89247a67d7ed847d10dc84a176c9b4dd037f4	2026-10-20 17:13:33.068+03	2026-10-13 17:13:33.069+03	\N	\N
3997aef8-de93-4741-b6b2-1ee252f3b0df	7ecd2c5d-ff55-46d2-a11c-b4888b8bec69	78d2583e9b2d722e815fa8b984d605a9ee1d4c6c0a62b22cfa4b52e2457de27a	2026-10-20 17:13:58.887+03	2026-10-13 17:13:58.888+03	2026-10-13 17:14:28.817+03	113c3edc-9f82-4b93-9f78-ba79bebdd40f
113c3edc-9f82-4b93-9f78-ba79bebdd40f	7ecd2c5d-ff55-46d2-a11c-b4888b8bec69	a65c29a4097ec3caaf1bdd28526bf85f58fa32dbd2dfaab24730ebe4fadb2b64	2026-10-20 17:14:28.817+03	2026-10-13 17:14:28.818+03	2026-10-13 17:25:22.625+03	83ab3808-2ef8-4849-b5c6-a0a48d3244b3
83ab3808-2ef8-4849-b5c6-a0a48d3244b3	7ecd2c5d-ff55-46d2-a11c-b4888b8bec69	c243ae5862230375fa0d7a1c2371078f6aa56fa3a6ff372bd589e7a9d2bf71ab	2026-10-20 17:25:22.625+03	2026-10-13 17:25:22.627+03	2026-10-13 17:26:11.221+03	def265de-e468-4ec9-b410-b7551065b55e
def265de-e468-4ec9-b410-b7551065b55e	7ecd2c5d-ff55-46d2-a11c-b4888b8bec69	8d42c7e237175c011ee91644bcd12d7db69ce5f9756fcc9217032f4137054d82	2026-10-20 17:26:11.221+03	2026-10-13 17:26:11.222+03	2026-10-13 17:26:21.007+03	79d3efb4-ee54-4972-9e66-ca8948620d4e
df7d4541-86eb-41d4-a78b-e9dbbf4243d9	7ecd2c5d-ff55-46d2-a11c-b4888b8bec69	ce3381f7852d2fb8b8d21c6839b78610e9033052f6bd22fcc8461b07f96930b1	2026-10-20 17:26:50.101+03	2026-10-13 17:26:50.102+03	\N	\N
79d3efb4-ee54-4972-9e66-ca8948620d4e	7ecd2c5d-ff55-46d2-a11c-b4888b8bec69	a57bbcc56300c19258abc74744810e92ed8931cdf8ae7cbbb3e4df0bc8c46b03	2026-10-20 17:26:21.007+03	2026-10-13 17:26:21.008+03	2026-10-13 17:26:50.101+03	df7d4541-86eb-41d4-a78b-e9dbbf4243d9
fd97a8d6-9a9b-49b7-b060-ad6172941f32	8f02dca5-df33-4769-a56c-0215c448d0e4	8e9d0c865ebf50a0b37062ece2eb445a2c1a0fbf1f2da1fffccd52804362ee34	2026-10-20 17:26:59.352+03	2026-10-13 17:26:59.353+03	2026-10-13 17:27:25.471+03	09bd0f1b-9a7f-4dbd-8245-caca186d1742
2c265e6e-2fe0-4aed-89a6-749a0184ad1d	8f02dca5-df33-4769-a56c-0215c448d0e4	4a26b92655897abcb066e8d7e2772bc6b7d091cdd0322d0a8265ea85db7c89b4	2026-10-20 18:49:21.285+03	2026-10-13 18:49:21.286+03	\N	\N
09bd0f1b-9a7f-4dbd-8245-caca186d1742	8f02dca5-df33-4769-a56c-0215c448d0e4	4774c5f4468ec03134b0ccdab29fc26cd97b3b22527a692002dafd8c655560f1	2026-10-20 17:27:25.471+03	2026-10-13 17:27:25.472+03	2026-10-13 18:49:21.284+03	2c265e6e-2fe0-4aed-89a6-749a0184ad1d
ca779be2-8515-4e33-8236-2ee6a80b9661	da4b17da-124d-4115-b6b2-1674b3a371ac	7c02c70508a7c1ec1943f034a123fb56b5be9f5b4f58ba65450e4d6f564410bd	2026-10-20 18:50:29.381+03	2026-10-13 18:50:29.382+03	\N	\N
e6ab94d3-1ece-4364-a207-3c64ac918793	da4b17da-124d-4115-b6b2-1674b3a371ac	d9d169dd5bd773511eaa2b50e75d38833d8d5f00fc7a6147b1edc77caa432cdd	2026-10-20 18:49:49.192+03	2026-10-13 18:49:49.193+03	2026-10-13 18:50:29.381+03	ca779be2-8515-4e33-8236-2ee6a80b9661
fd2301fe-c25c-4566-b5df-23d8abcb6f2b	0fe136c8-9d3e-4e8a-a66b-5edcf51934a2	43c0dad5aef126109a6f38feccaf8316f03b741e4667b12cda8942eaaf3ff730	2026-10-20 19:16:20.433+03	2026-10-13 19:16:20.434+03	\N	\N
b85f701f-755f-446a-bea2-d3d1e98f7094	0fe136c8-9d3e-4e8a-a66b-5edcf51934a2	576fa91baf0bc715ea25d6114feae837e688394a218c28dbf7a721239382c330	2026-10-20 18:50:35.6+03	2026-10-13 18:50:35.601+03	2026-10-13 19:16:20.433+03	fd2301fe-c25c-4566-b5df-23d8abcb6f2b
8c8ce1cb-c844-4812-96bf-801360443a74	00124014-1211-4086-aa3e-28773f69839d	a60f0a95765d1ddace32c62c72575eb96f935c774cfc218b1bd98aaf81368829	2026-10-20 19:18:35.297+03	2026-10-13 19:18:35.298+03	\N	\N
0f93ac84-5ae4-48d6-a4d6-3f41f32aea48	61fd5e42-7e70-4b30-94b3-4b890e6662d1	e4ce49d46fdaa7e973d9816cf48fe6284ed7890a0efe4e1bb239fe7a8819fb89	2026-10-20 19:20:34.24+03	2026-10-13 19:20:34.24+03	2026-10-13 19:24:32.719+03	47e908f1-2114-4a0b-9a89-4b26133ca756
47e908f1-2114-4a0b-9a89-4b26133ca756	61fd5e42-7e70-4b30-94b3-4b890e6662d1	38271199e9f32c8bd442b7d1bbcecfd941a4fe9ccf82d8aa0d1cfbb80f901e25	2026-10-20 19:24:32.72+03	2026-10-13 19:24:32.721+03	2026-10-13 19:24:47.1+03	94a1ba22-9510-444b-bfec-1f69e991cfab
94a1ba22-9510-444b-bfec-1f69e991cfab	61fd5e42-7e70-4b30-94b3-4b890e6662d1	2334f2bb60d8977e93b3e485d5a48af6ae3c8ee1c34ed3b2bfc7a4b8785f0215	2026-10-20 19:24:47.1+03	2026-10-13 19:24:47.101+03	2026-10-13 19:25:21.381+03	5af0cfac-6a5a-49d6-a945-c512f410c386
5af0cfac-6a5a-49d6-a945-c512f410c386	61fd5e42-7e70-4b30-94b3-4b890e6662d1	bfba3f8bd88e69596bdc381884396a792e0a8d842b17f8cbafc2d6bd8953e6a9	2026-10-20 19:25:21.381+03	2026-10-13 19:25:21.383+03	2026-10-13 19:30:09.707+03	10478512-ad0f-4ff7-b6ea-e5740dab1b5c
fc613286-e5e8-4622-a474-1c31dca16604	61fd5e42-7e70-4b30-94b3-4b890e6662d1	55875ba57d7e80a66825d1dd66d1f0ff892532821e9343c51c4be051f32a34fb	2026-10-20 19:30:56.293+03	2026-10-13 19:30:56.295+03	\N	\N
10478512-ad0f-4ff7-b6ea-e5740dab1b5c	61fd5e42-7e70-4b30-94b3-4b890e6662d1	8bc355b6149147f75bc2ad7df9c569395744f0d200a6d47c9c2fd5d2cc0ad923	2026-10-20 19:30:09.707+03	2026-10-13 19:30:09.708+03	2026-10-13 19:30:56.292+03	fc613286-e5e8-4622-a474-1c31dca16604
\.


--
-- Data for Name: refunds; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.refunds (id, payment_id, booking_id, amount, currency, status, reason, processed_at, created_at, provider_reference, updated_at) FROM stdin;
60a56288-0293-4342-a09f-6d0010c11068	0e3bd9c8-c42a-4205-84d8-56ac6890c9b5	31f0228f-002b-4a71-9335-e5845c66538b	127.00	EUR	REJECTED	\N	\N	2026-10-06 15:51:46.271+03	\N	2026-10-07 23:15:19.651672+03
614943cd-d913-41d1-b771-1a8f9f17b27a	74aa0b32-8f39-4ea1-8d12-783ed929913a	4226ef1a-2643-4ff4-9669-05fdbc7c3157	127.00	EUR	PROCESSED	not good	2026-10-06 23:46:12.895+03	2026-10-06 23:46:11.653+03	re_3UNfBvRplmQkGUx51PelnMIR	2026-10-07 23:15:19.651672+03
80552ee7-096d-4bb5-9767-3fb9bdd2e7e6	e95cc36d-401d-47a5-a2c2-5a88349683d4	802d1dac-67ac-44d9-a153-a5b6036fc90f	1547.90	EUR	PROCESSED	not accepted for booking	2026-10-08 14:58:31.556+03	2026-10-08 14:58:30.035+03	re_3UOFvLRplmQkGUx510utaHcA	2026-10-08 14:58:31.558+03
bc869b01-7578-4d07-8cca-7a74e7318c7f	ef3ad2c6-d2e1-49f5-a134-e02166afc5b9	108319d0-5696-4498-9c66-d05e5b1b2f99	2780.00	EUR	PROCESSED	\N	2026-10-08 17:39:59.618+03	2026-10-08 17:39:58.513+03	re_3UOIRnRplmQkGUx50L9ijXaR	2026-10-08 17:39:59.619+03
a0d7f7eb-5042-41ce-8331-17d47f00205f	87a38b88-cf77-491c-81bf-c12895e99361	3401d257-c7fd-4416-a482-9b5de1efaf34	1309.00	EUR	PROCESSED	refuned accepted	2026-10-13 19:20:05.234+03	2026-10-13 19:20:04.008+03	re_3UQ8O7RplmQkGUx5135Syzgr	2026-10-13 19:20:05.235+03
\.


--
-- Data for Name: role_permissions; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.role_permissions (id, role_id, permission_id) FROM stdin;
6834ba6a-0c55-40e0-9836-339e294d1a80	0950aaed-b179-4283-97bf-29186a454d1f	3d9cc0e0-e1a1-4bcf-9063-fbeb6529ff7b
6a31723c-e8ee-4677-9269-60d6198ebfd6	0950aaed-b179-4283-97bf-29186a454d1f	55c79341-375a-416f-9199-89932ed9e7a7
f0b51a53-23c5-433b-a70c-244afb56bafa	0950aaed-b179-4283-97bf-29186a454d1f	5b296d75-9ff2-4157-8125-d29806010f07
e2e50fa0-2eeb-42fe-9578-8883b55619c9	0950aaed-b179-4283-97bf-29186a454d1f	81e34ed5-eb22-45bd-a3ac-3acd347bd3de
4488a64d-0e59-42e8-80a2-a8bed6d13c74	0950aaed-b179-4283-97bf-29186a454d1f	97415b68-405f-4b18-945e-fb803cb35c3b
3fb59be8-f5d3-4c43-a8fd-193151c25b6a	0950aaed-b179-4283-97bf-29186a454d1f	5f99eadb-1489-48e1-8399-fb78e0e617b1
8dcea458-064f-408e-9b0b-5e0859ebfc49	0950aaed-b179-4283-97bf-29186a454d1f	681a2b22-b85c-4ab3-a1ea-995b87490026
b54f14da-1f20-4a96-bf93-ab91468e9753	0950aaed-b179-4283-97bf-29186a454d1f	7f974748-4c5d-4e59-8ac1-93b03a70c531
8767d8b1-2e19-42f9-b607-0144a2b702f1	0950aaed-b179-4283-97bf-29186a454d1f	33ac0729-1dee-4838-badd-966bc1852bbc
ce374fb1-5c78-4db9-bfcc-fb20d9f994cf	43f19c03-b120-4383-8dec-572c8f50039a	7be1d752-85fb-4847-bc89-cce76a4bb7cc
bbcf96fe-4bb9-4210-94ff-d4b82272f646	43f19c03-b120-4383-8dec-572c8f50039a	fc1b04cc-2db2-4469-bb00-77c475dc320f
020c0bed-9a51-4c0a-ac5e-375b42a441b3	43f19c03-b120-4383-8dec-572c8f50039a	f6fce2a0-b767-48f8-a7e3-9b33abbba53a
1c8ac251-e2c6-40e0-930f-c3b6e74e87f7	43f19c03-b120-4383-8dec-572c8f50039a	12883033-8fd3-4fc2-b0c1-7688d4a1e113
f89c0a65-bb99-471a-8133-8400675f7d17	43f19c03-b120-4383-8dec-572c8f50039a	a817eba6-8adf-4b50-8684-50e47e486cd2
09d80362-f381-47ea-b354-45aa8ed26364	43f19c03-b120-4383-8dec-572c8f50039a	33ac0729-1dee-4838-badd-966bc1852bbc
715c814f-748d-46ce-a8f7-ce357bf2fef3	644c62e1-fdf4-4b6d-b582-03e2d665181a	97415b68-405f-4b18-945e-fb803cb35c3b
aa17129b-e2a2-436c-b7f3-59a93e43db87	644c62e1-fdf4-4b6d-b582-03e2d665181a	5f99eadb-1489-48e1-8399-fb78e0e617b1
44905da6-f3c8-4eaf-a758-c004cd28069e	644c62e1-fdf4-4b6d-b582-03e2d665181a	3d9cc0e0-e1a1-4bcf-9063-fbeb6529ff7b
f92e16f1-658b-41dd-b455-ef09fc4cb365	644c62e1-fdf4-4b6d-b582-03e2d665181a	33ac0729-1dee-4838-badd-966bc1852bbc
117e03fb-d12a-4b20-b054-5c75ad4e4587	6b0d0393-3abb-41fd-bd16-da2875be84a2	92c1b575-e93f-4afe-a24d-82dc204dc186
846f592f-edc1-4045-9338-9b0e1f20206a	6b0d0393-3abb-41fd-bd16-da2875be84a2	3a482e60-bd35-4b48-bd65-2b2ddbd413fe
7187f9ca-ca24-481d-9346-d9d83e05d956	6b0d0393-3abb-41fd-bd16-da2875be84a2	681a2b22-b85c-4ab3-a1ea-995b87490026
b6978fbb-d413-4ce5-98aa-1b854840f3ba	6b0d0393-3abb-41fd-bd16-da2875be84a2	33ac0729-1dee-4838-badd-966bc1852bbc
c0d2da5d-23e9-47d9-9962-95d7e18175a3	b32d9101-d19a-4dd3-bee1-7b31aa3d8754	3d9cc0e0-e1a1-4bcf-9063-fbeb6529ff7b
50b65836-f564-49fa-8562-21eea9887033	b32d9101-d19a-4dd3-bee1-7b31aa3d8754	97415b68-405f-4b18-945e-fb803cb35c3b
c0757565-9f81-49cc-952f-de6e075e9636	b32d9101-d19a-4dd3-bee1-7b31aa3d8754	94ab4535-70d6-485e-b266-83072661d89f
4ad1d709-f5d9-4b7c-bf82-6eba02dad658	b32d9101-d19a-4dd3-bee1-7b31aa3d8754	91eb19db-0c0b-44ca-9818-7215046b552d
18b98a17-3b51-4f12-a856-11a2bdbea547	b32d9101-d19a-4dd3-bee1-7b31aa3d8754	33ac0729-1dee-4838-badd-966bc1852bbc
\.


--
-- Data for Name: roles; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.roles (id, name, description, is_super_admin, created_at, updated_at) FROM stdin;
6dad78ee-b631-4616-9db0-c6abfb40b603	Customer	Default customer role	f	2026-09-30 11:58:48.442+03	2026-09-30 11:58:48.442+03
3b7e8868-4ad2-4e25-b942-98f6b9bdde85	Super Admin	Full system access	t	2026-09-30 12:51:11.691+03	2026-10-08 16:16:38.248+03
0950aaed-b179-4283-97bf-29186a454d1f	Administrator	Access to assigned administrative modules	f	2026-09-30 12:51:11.693+03	2026-10-08 16:16:38.25+03
43f19c03-b120-4383-8dec-572c8f50039a	Flight Manager	Manages flight operations	f	2026-09-30 12:51:11.779+03	2026-10-08 16:16:38.265+03
644c62e1-fdf4-4b6d-b582-03e2d665181a	Booking Manager	Manages reservations	f	2026-09-30 12:51:11.901+03	2026-10-08 16:16:38.272+03
6b0d0393-3abb-41fd-bd16-da2875be84a2	Finance Staff	Views payments and refunds	f	2026-09-30 12:51:11.964+03	2026-10-08 16:16:38.278+03
b32d9101-d19a-4dd3-bee1-7b31aa3d8754	Support Staff	Customer and booking support	f	2026-09-30 12:51:12.015+03	2026-10-08 16:16:38.283+03
\.


--
-- Data for Name: routes; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.routes (id, origin_airport_id, destination_airport_id, distance_km, duration_minutes, status) FROM stdin;
943532db-69c1-4884-85c6-2cfa694b514f	56f760aa-9f77-40da-9880-581624191508	739a55a1-a38b-41e3-8f3e-348a582fcf88	6201	505	ACTIVE
379dce15-7ee8-4186-9027-111bf7e83abd	56f760aa-9f77-40da-9880-581624191508	07d67ec0-2efa-4485-b74d-f5156273330b	9324	700	ACTIVE
87f543d2-c61e-4572-b3e7-12f29151086b	56f760aa-9f77-40da-9880-581624191508	7c3a41dc-73a3-417a-bab7-2ee5f06daacd	10278	740	ACTIVE
e71881e6-2ac8-4a16-b765-49e8b606b164	56f760aa-9f77-40da-9880-581624191508	d6b7a579-13a1-47d6-8451-720197c108b7	4843	375	ACTIVE
643dcac0-9a80-412e-bd66-6c7fa54a8333	a5300691-8411-4381-8b35-b731e16872de	2e7ffc07-e7e3-4a34-8495-041f54670d58	942	120	ACTIVE
01b176f9-3c1b-479e-987c-874cde6c4334	a5300691-8411-4381-8b35-b731e16872de	c2fecbff-abee-4266-988b-5e6baab68df3	840	110	ACTIVE
a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	dfaf5872-2099-4b98-aa3c-7524d411ea69	a5bd232c-ae03-4955-ab57-bc31296df060	379	65	ACTIVE
0f2aaaca-2cbb-4d1c-923f-5a133d248c89	739a55a1-a38b-41e3-8f3e-348a582fcf88	07d67ec0-2efa-4485-b74d-f5156273330b	3983	355	ACTIVE
\.


--
-- Data for Name: schedule_rules; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.schedule_rules (id, route_id, aircraft_id, flight_number, departure_time_local, operating_days, effective_from, effective_to, status, created_at, updated_at) FROM stdin;
d681ae6c-9b2b-45da-a8ae-f7becbceb669	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	NV100	08:00	{MON,TUE,WED,THU,FRI,SAT,SUN}	2026-09-30	2027-09-30	ACTIVE	2026-09-30 12:51:12.296+03	2026-10-08 16:16:38.383+03
c57ce3a8-ffa7-4074-b275-cf016cbc2344	379dce15-7ee8-4186-9027-111bf7e83abd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	NV101	09:30	{MON,TUE,WED,THU,FRI,SAT,SUN}	2026-09-30	2027-09-30	ACTIVE	2026-09-30 12:51:12.309+03	2026-10-08 16:16:38.386+03
97adedb1-cc34-40ca-a5c8-9357b7f1927b	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	NV102	10:00	{MON,TUE,WED,THU,FRI,SAT,SUN}	2026-09-30	2027-09-30	ACTIVE	2026-09-30 12:51:12.31+03	2026-10-08 16:16:38.389+03
dfeec557-d003-458f-a2e2-ebb9b42cf3cf	e71881e6-2ac8-4a16-b765-49e8b606b164	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	NV103	11:30	{MON,TUE,WED,THU,FRI,SAT,SUN}	2026-09-30	2027-09-30	ACTIVE	2026-09-30 12:51:12.312+03	2026-10-08 16:16:38.391+03
31300134-dd07-4bfd-92d4-b210ddd72d9a	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	NV104	12:00	{MON,TUE,WED,THU,FRI,SAT,SUN}	2026-09-30	2027-09-30	ACTIVE	2026-09-30 12:51:12.314+03	2026-10-08 16:16:38.393+03
f26b75b3-afa9-4ef7-bf0b-cd47293e2933	01b176f9-3c1b-479e-987c-874cde6c4334	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	NV105	13:30	{MON,TUE,WED,THU,FRI,SAT,SUN}	2026-09-30	2027-09-30	ACTIVE	2026-09-30 12:51:12.316+03	2026-10-08 16:16:38.395+03
11cf84f0-9916-4aa3-8981-fa9dbaa078f1	a6c03b18-8aa1-48c7-8f33-1e5e85c924e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	NV106	14:00	{MON,TUE,WED,THU,FRI,SAT,SUN}	2026-09-30	2027-09-30	ACTIVE	2026-09-30 12:51:12.318+03	2026-10-08 16:16:38.397+03
71eb1bba-7416-4c04-a2ea-dbc2cdc04977	0f2aaaca-2cbb-4d1c-923f-5a133d248c89	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	NV107	15:30	{MON,TUE,WED,THU,FRI,SAT,SUN}	2026-09-30	2027-09-30	ACTIVE	2026-09-30 12:51:12.319+03	2026-10-08 16:16:38.399+03
290a78fa-08c0-4309-b86d-673e9c94eb97	943532db-69c1-4884-85c6-2cfa694b514f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	NV200	18:30	{MON,WED,FRI,SUN}	2026-09-30	2027-09-30	ACTIVE	2026-09-30 12:51:12.32+03	2026-10-08 16:16:38.401+03
e17725fc-5f3c-4b7a-b1ac-4983ccb776e4	87f543d2-c61e-4572-b3e7-12f29151086b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	NV201	22:15	{TUE,THU,SAT}	2026-09-30	2027-09-30	ACTIVE	2026-09-30 12:51:12.322+03	2026-10-08 16:16:38.403+03
adf6075e-b6f9-4e5e-87c5-a37b4662cea7	643dcac0-9a80-412e-bd66-6c7fa54a8333	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	NV202	07:15	{MON,TUE,WED,THU,FRI}	2026-09-30	2027-09-30	ACTIVE	2026-09-30 12:51:12.323+03	2026-10-08 16:16:38.404+03
\.


--
-- Data for Name: seat_holds; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.seat_holds (id, flight_id, seat_id, user_id, session_id, status, expires_at, created_at, booking_id) FROM stdin;
86ba1e98-624a-458b-823f-b1bb9f0d343d	12875a5c-930c-44ac-8236-6f2c55275bc6	ca803440-a304-4be1-88be-5b5e909903b6	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	CONVERTED	2026-09-30 22:30:32.057+03	2026-09-30 22:15:32.417+03	ab28ceb3-4cc4-4fef-8046-422df882e775
ebf14b60-f6db-446b-926a-c92a94319526	596afd03-ff24-4a78-961c-06655a623edd	342495d2-64dd-442e-a728-c317997d198a	34eedc56-29ef-4665-87fa-648c6a23dc72	\N	EXPIRED	2026-10-01 12:51:13.586+03	2026-09-30 12:51:13.59+03	90886c87-c794-4803-ab23-402563190062
eec0ccff-20e1-4319-b34e-cee87441c663	7db80102-6eb4-4c62-9ec2-e214e513a2c0	63455012-09da-4c62-8fee-c83c16379ef2	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	EXPIRED	2026-10-05 18:42:04.912+03	2026-10-05 18:27:04.94+03	13c5bbe6-f2d3-4be3-9acb-8b20e896867b
55178d36-995b-4cba-919e-af8f5981e554	7db80102-6eb4-4c62-9ec2-e214e513a2c0	63455012-09da-4c62-8fee-c83c16379ef2	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	CONVERTED	2026-10-05 19:31:33.317+03	2026-10-05 19:16:33.335+03	8a4fb707-cd06-4b81-858f-68c678d43a8d
cca3dde0-392a-47c5-87ab-ad50e96a6865	fc9dc5a1-a972-4be8-9473-9442d5faabd4	ca803440-a304-4be1-88be-5b5e909903b6	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	CONVERTED	2026-10-06 02:17:35.604+03	2026-10-06 02:02:35.629+03	31f0228f-002b-4a71-9335-e5845c66538b
2f6b7c8d-2887-4316-9242-272cf1e6cdcc	d94d7a82-45b0-495e-ab90-df511b64e086	57986a8e-dc4a-468a-9127-092f9b92d50a	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	EXPIRED	2026-10-06 15:49:52.372+03	2026-10-06 15:34:52.411+03	e4efd9f8-c6c9-44a8-96b5-ca3e6cce8e45
0ccdf4f6-0b10-4227-b8e6-cdedca833b98	d94d7a82-45b0-495e-ab90-df511b64e086	fdef9fcd-ba62-4347-b1c7-0d1081a5e854	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	EXPIRED	2026-10-06 16:13:38.298+03	2026-10-06 15:58:38.332+03	00598b8b-835f-442a-a2f2-ad6d0bf3417f
0c6e6ed6-c664-49bb-a312-7e26a7916b0d	c9da46d2-0f00-452b-8356-87af4b6b3bee	01b6adaa-759c-4a11-85a3-7ecf91b5be67	34eedc56-29ef-4665-87fa-648c6a23dc72	\N	CONVERTED	2026-10-06 16:58:48.896+03	2026-10-06 16:43:48.925+03	b80a3617-7cb0-4566-90cc-441ef0c6ab77
c35bb278-eb41-4764-abfc-aa08fcd85eac	fc9dc5a1-a972-4be8-9473-9442d5faabd4	6fc81f38-cca3-4f59-8ac5-d22c817e8fd3	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	EXPIRED	2026-10-06 16:46:32.516+03	2026-10-06 16:31:32.898+03	aa78e754-4d26-4759-891f-81febda53c2c
8923db9b-e7ed-4616-88fb-25ae44a2445e	c9da46d2-0f00-452b-8356-87af4b6b3bee	0614b991-bf70-4334-a939-6932f98705f7	34eedc56-29ef-4665-87fa-648c6a23dc72	\N	EXPIRED	2026-10-06 17:01:00.555+03	2026-10-06 16:46:00.565+03	e0137147-5d75-4ece-a4a1-b445a857193e
087147c8-ba76-46df-be2c-7a035a8df77a	c9da46d2-0f00-452b-8356-87af4b6b3bee	0638c1a2-0ad8-48d9-a38f-b4908c204023	34eedc56-29ef-4665-87fa-648c6a23dc72	\N	EXPIRED	2026-10-06 17:02:00.152+03	2026-10-06 16:47:00.178+03	2dd1ce15-a14f-46b5-b47f-a29f17fc4028
3ef72ae4-87ed-41c5-9c0d-e1892d988be7	c9da46d2-0f00-452b-8356-87af4b6b3bee	57986a8e-dc4a-468a-9127-092f9b92d50a	34eedc56-29ef-4665-87fa-648c6a23dc72	\N	EXPIRED	2026-10-06 17:04:28.313+03	2026-10-06 16:49:28.325+03	56a6a3e3-36d1-460a-bae7-1acaa3327684
ac4f89b2-1265-449c-a010-bb3297e286ee	d94d7a82-45b0-495e-ab90-df511b64e086	39c9495e-6ef9-4251-bdfc-10227997fefa	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	EXPIRED	2026-10-06 17:47:56.821+03	2026-10-06 17:32:56.852+03	59a7ed52-c362-44f1-b545-292fee0bf836
5a799686-4a03-408f-9b01-e11b24ebafa7	fc9dc5a1-a972-4be8-9473-9442d5faabd4	911594dc-708b-464d-a7ef-aa8d6b5878aa	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	RELEASED	2026-10-06 18:13:11.314+03	2026-10-06 17:58:11.345+03	56a92bc1-1398-4fb3-911c-f60891b143a3
c7e10b77-1566-4707-9f56-bf7e86f44c8e	c9da46d2-0f00-452b-8356-87af4b6b3bee	fdef9fcd-ba62-4347-b1c7-0d1081a5e854	34eedc56-29ef-4665-87fa-648c6a23dc72	\N	EXPIRED	2026-10-06 18:09:57.777+03	2026-10-06 17:54:57.92+03	ed6701ed-813e-4027-a3e1-0a01d3d911e3
16b7e662-9d53-4c0b-9ff0-f8e914c9935d	c9da46d2-0f00-452b-8356-87af4b6b3bee	82bd664c-105e-4118-923c-99c21a5e445c	34eedc56-29ef-4665-87fa-648c6a23dc72	\N	CONVERTED	2026-10-06 18:28:53.821+03	2026-10-06 18:13:54.102+03	e6f4fba4-c2c1-41eb-ac31-0fd41cd99b5b
49c2239c-1aac-4d15-b90f-70de2fcc77d2	66916b93-2a6f-4123-bc5c-32fa5a054c44	44b53c2e-449e-459d-a91f-e217fda3c645	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	CONVERTED	2026-10-06 18:45:04.327+03	2026-10-06 18:30:04.456+03	b080bb80-af80-4f63-b70b-5963cea26f6c
38191fca-6aa4-4e46-9a51-ae18f06c2aad	1db470f2-964f-4bb5-99f7-d61b297536f1	923c1a78-eac6-4906-9535-27459d4d435a	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	CONVERTED	2026-10-06 23:57:18.954+03	2026-10-06 23:42:18.984+03	4226ef1a-2643-4ff4-9669-05fdbc7c3157
f545d8fd-1b13-42c2-9f21-92e9770af958	9f101579-1c7e-4095-ab28-0a1df8a72f7a	ca803440-a304-4be1-88be-5b5e909903b6	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	CONVERTED	2026-10-07 12:43:45.752+03	2026-10-07 12:28:45.795+03	8f0251b4-1af2-4397-a781-ac7f2b6ceedc
105f749e-d1a3-4f48-b123-4eb5278eb54c	455173a4-d421-4164-9e77-48d0b9798870	3130b36e-3e19-4c57-8aaf-bb4d61cb08ce	24e598b1-ee10-457d-83bc-122a7e1ba398	\N	CONVERTED	2026-10-07 15:26:05.112+03	2026-10-07 15:11:05.147+03	ec52f2d5-f1cc-4707-8a00-32cc1b503a69
3b8423b4-3179-4737-af22-9fa43b170517	0857ec3e-f50f-42c0-bbb0-0a165581739e	4f4a8f95-dcd4-47f2-b5be-671f6b947e89	24e598b1-ee10-457d-83bc-122a7e1ba398	\N	CONVERTED	2026-10-08 14:38:47.611+03	2026-10-08 14:23:47.641+03	4236a14f-fe34-413a-b3e8-9d855720b6bb
bab0efee-4013-41d3-9f88-f4d0e2029aeb	70733ce0-3cf8-407b-8dc5-7e4555d1b9a6	929f23d9-19bf-442a-9af8-6daf0cd56941	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	CONVERTED	2026-10-08 15:10:42.327+03	2026-10-08 14:55:42.369+03	802d1dac-67ac-44d9-a153-a5b6036fc90f
ce3b384d-f12c-45df-ae6f-2c6eb1363bcc	a9e32a56-4d3c-415f-b617-f7b8fc453829	70ea884f-90fd-400e-8ea4-9e1513c96d1b	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	CONVERTED	2026-10-08 17:52:22.233+03	2026-10-08 17:37:22.264+03	108319d0-5696-4498-9c66-d05e5b1b2f99
34d3fd52-0c02-44a5-a567-fc9d77fe1014	2580c8ab-904b-45b7-a934-28126b1be077	78cd5be8-c278-4035-b5f7-fa331fb1a4dc	24e598b1-ee10-457d-83bc-122a7e1ba398	\N	CONVERTED	2026-10-12 00:42:08.059+03	2026-10-12 00:27:08.09+03	6a18720e-6788-4b8f-b236-3cae380f8143
47b1fa98-2633-43bd-9434-d9e69d32af28	a96d8963-6988-4ecf-a6b3-2e77ff6429e3	05cb5511-816e-4f9d-8904-de85006dcb6a	24e598b1-ee10-457d-83bc-122a7e1ba398	\N	CONVERTED	2026-10-12 12:14:31.474+03	2026-10-12 11:59:31.509+03	1c01d63f-133c-4aa4-8644-83787c65601d
bea23645-a1d9-4bea-9872-a8f693be840e	478b8417-f3ff-436b-8f9d-938ddddb830c	58f1a93f-5122-4102-ba32-8dd7ead6efdc	c420004f-c75c-4c25-947e-d9d0e6c3aa44	\N	CONVERTED	2026-10-12 15:21:45.617+03	2026-10-12 15:06:45.734+03	e27218a4-ec6a-4801-84f1-3207b73af8aa
a6d15617-a273-452c-8cb8-f2176912e927	818d5802-4003-416a-833f-0b1fc8360033	95e3f33e-fad2-4462-b700-0afa1634b578	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	CONVERTED	2026-10-13 16:11:42.702+03	2026-10-13 15:56:42.733+03	b9146650-2237-4534-b220-2279ee9547d3
ed0c52dc-5d29-4af1-9efb-acfde957a6f0	b3e5c692-9dcc-4238-be2f-b7076e16debb	ba202295-edeb-475e-a85a-378daa9f94df	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	\N	CONVERTED	2026-10-13 17:47:06.662+03	2026-10-13 17:32:06.694+03	81c4405c-835d-4005-bb06-38a7f7efb2a6
288d23c3-3089-400c-80ec-5ce75b0d9af2	b3e5c692-9dcc-4238-be2f-b7076e16debb	4051f4fc-4199-4257-aba9-79c8ed696ad8	c420004f-c75c-4c25-947e-d9d0e6c3aa44	\N	CONVERTED	2026-10-13 19:32:12.905+03	2026-10-13 19:17:12.946+03	3401d257-c7fd-4416-a482-9b5de1efaf34
\.


--
-- Data for Name: seats; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.seats (id, aircraft_id, seat_number, cabin_class, seat_row, seat_column, features, is_exit_row) FROM stdin;
ca803440-a304-4be1-88be-5b5e909903b6	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	1A	ECONOMY	1	A	{}	f
4d4c05a5-3e83-47e7-9f01-5740a942dd50	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	1B	ECONOMY	1	B	{}	f
6fc81f38-cca3-4f59-8ac5-d22c817e8fd3	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	1C	ECONOMY	1	C	{}	f
e9a385f3-6a85-4de7-a1ab-2af0485bfe4c	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	1D	ECONOMY	1	D	{}	f
d9beb644-cd4b-4cfb-acd7-189055006c04	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	1E	ECONOMY	1	E	{}	f
97a1bf4c-0c1e-4dc9-bcf5-e2ee01546072	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	1F	ECONOMY	1	F	{}	f
157218e8-5ec5-4e1b-a906-8c5d5fb3f96d	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2A	ECONOMY	2	A	{}	f
05cb5511-816e-4f9d-8904-de85006dcb6a	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2B	ECONOMY	2	B	{}	f
911594dc-708b-464d-a7ef-aa8d6b5878aa	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2C	ECONOMY	2	C	{}	f
7f027698-f1cf-4ddd-a748-fd4b5c985f0d	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2D	ECONOMY	2	D	{}	f
02257ba0-a8ec-4339-97c3-3374b623f1e1	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2E	ECONOMY	2	E	{}	f
65fe8c9f-c61b-4df9-a8e6-d691aaa19567	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	2F	ECONOMY	2	F	{}	f
390a9c8b-2d1b-4e2f-8fa9-65ac28a88991	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	3A	ECONOMY	3	A	{}	f
10ff5c90-7d4c-40b1-9256-8a3ff5092b1f	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	3B	ECONOMY	3	B	{}	f
400af6c8-d6a3-4cee-98b8-a5680fb21b65	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	3C	ECONOMY	3	C	{}	f
c0b71c89-dc2d-47e4-b156-d302c974d0b9	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	3D	ECONOMY	3	D	{}	f
c0930016-afe7-4060-80fa-4dca43e7c0c2	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	3E	ECONOMY	3	E	{}	f
33e308bf-50a2-4481-a7d3-b039d02d7d0f	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	3F	ECONOMY	3	F	{}	f
e73a449f-59ca-47ab-9cf4-123683d6cdd2	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	4A	ECONOMY	4	A	{}	f
5d4ad481-cb24-41e8-b153-8e06fcdca408	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	4B	ECONOMY	4	B	{}	f
4f4a8f95-dcd4-47f2-b5be-671f6b947e89	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	4C	ECONOMY	4	C	{}	f
96283789-dbd1-4554-b44d-c8dae5bed65e	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	4D	ECONOMY	4	D	{}	f
41d583ac-015f-4591-bad1-01ce7a883eab	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	4E	ECONOMY	4	E	{}	f
3f14eb5d-c834-4985-bbd1-cd7690b14b0c	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	4F	ECONOMY	4	F	{}	f
789953f2-761f-49ab-b881-8eb08403d0a5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	5A	ECONOMY	5	A	{}	f
6f4585b6-19fa-43dd-9123-a1d9bde4f599	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	5B	ECONOMY	5	B	{}	f
923c1a78-eac6-4906-9535-27459d4d435a	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	5C	ECONOMY	5	C	{}	f
fdebe347-30b8-4b0b-a3a9-0f954d5864e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	5D	ECONOMY	5	D	{}	f
262ab7c5-7d37-4c20-9371-396fe7fb7206	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	5E	ECONOMY	5	E	{}	f
0934859c-7290-45c4-95fb-4f5edfb66925	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	5F	ECONOMY	5	F	{}	f
f5d9ec98-244a-4fa3-aa7b-d412cd1ada19	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	6A	ECONOMY	6	A	{}	f
5b5c9a6d-b55c-4b76-9ae2-61b3819916e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	6B	ECONOMY	6	B	{}	f
6774b92c-2d63-4885-9145-e66bd4cce909	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	6C	ECONOMY	6	C	{}	f
a70006b1-c5aa-47b6-b951-eab985d5c886	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	6D	ECONOMY	6	D	{}	f
40465e0f-3656-4c00-b40d-a31c134b693e	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	6E	ECONOMY	6	E	{}	f
cc15a0d4-0854-42e3-8d42-46135492f6f2	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	6F	ECONOMY	6	F	{}	f
5a83a7a8-8696-4ba5-9126-c566bbbb24e9	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	7A	ECONOMY	7	A	{}	f
50f22e1e-a848-43e2-abcf-f63ef4d78042	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	7B	ECONOMY	7	B	{}	f
0fa9ecd6-55d4-40b2-bb04-f1d8035952fb	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	7C	ECONOMY	7	C	{}	f
1d58e4c1-fba7-4a2f-a06e-700a34648bdf	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	7D	ECONOMY	7	D	{}	f
8700995f-e260-4ca8-8543-ab3dddb868a8	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	7E	ECONOMY	7	E	{}	f
0c4f2ca7-5ef7-494a-bd65-626e722c8848	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	7F	ECONOMY	7	F	{}	f
d6487da4-82e5-48d2-90fa-4d5adbc5982d	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	8A	ECONOMY	8	A	{}	f
c81b3708-9c54-4dd5-b0d3-d729bdf46184	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	8B	ECONOMY	8	B	{}	f
c9b9ac38-5493-40da-8872-6cd1ac95304b	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	8C	ECONOMY	8	C	{}	f
1b399473-96ec-490c-ae49-902333ee6a39	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	8D	ECONOMY	8	D	{}	f
113d198a-9eb4-4732-be4a-2e85d25bcf48	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	8E	ECONOMY	8	E	{}	f
87b8938e-0399-4bd9-b62c-6f3294bfebbf	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	8F	ECONOMY	8	F	{}	f
287b0d6a-999d-4eef-bd7f-d00af17a90ea	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	9A	ECONOMY	9	A	{}	f
4be57cf6-8143-458b-bd58-076812115e62	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	9B	ECONOMY	9	B	{}	f
2a17d8bb-d469-4c67-b8a0-884c759b543c	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	9C	ECONOMY	9	C	{}	f
a771ec45-890a-434d-b53b-9cacc9edc762	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	9D	ECONOMY	9	D	{}	f
70b32d92-0fdb-4841-ad38-58b29f15078e	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	9E	ECONOMY	9	E	{}	f
6676a126-dfff-4d55-8279-db4a83b466e5	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	9F	ECONOMY	9	F	{}	f
aafd8967-9995-4f8d-ba42-01914eb24a2c	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	10A	ECONOMY	10	A	{}	f
342495d2-64dd-442e-a728-c317997d198a	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	10B	ECONOMY	10	B	{}	f
5878cd32-0884-4e85-8ab8-5ef4be09eafb	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	10C	ECONOMY	10	C	{}	f
17fa51c8-4b7b-4024-80a1-51179335e715	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	10D	ECONOMY	10	D	{}	f
4f34417d-4a80-4ea4-9ea3-11067abe3bcc	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	10E	ECONOMY	10	E	{}	f
a1d4f4ab-1efd-4739-9f7a-90ee6556b4cf	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	10F	ECONOMY	10	F	{}	f
828b3ff6-9584-4505-9a2f-6e60684dcef1	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	11A	ECONOMY	11	A	{}	f
d10a4d41-cf2d-43d9-a21c-57c69db1f196	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	11B	ECONOMY	11	B	{}	f
77430b0f-dc66-4d5e-ae3f-5c2da7905d97	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	11C	ECONOMY	11	C	{}	f
e60a7c20-2988-4612-8489-adaab0a24325	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	11D	ECONOMY	11	D	{}	f
6e248025-bef7-4e56-a5bc-965290e215e9	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	11E	ECONOMY	11	E	{}	f
a5e19684-2265-470b-89aa-a6404c957d4b	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	11F	ECONOMY	11	F	{}	f
9d5deb8e-ecb0-44ca-b296-0368d0f8b0ef	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	12A	ECONOMY	12	A	{}	t
70afca0e-df16-4c15-bb8a-44ac1aaa5ca4	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	12B	ECONOMY	12	B	{}	t
56b6a30b-4d8c-40c5-892e-ce596351696b	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	12C	ECONOMY	12	C	{}	t
3b05b304-04c1-46cd-8a5b-92b64064fa28	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	12D	ECONOMY	12	D	{}	t
86e8d448-f8a5-4658-926b-40f90b1acc86	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	12E	ECONOMY	12	E	{}	t
8b6057c0-a053-451f-a117-db3378555582	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	12F	ECONOMY	12	F	{}	t
d38cd79e-f9f0-4582-9931-8c8c50c6bf6e	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	13A	ECONOMY	13	A	{}	f
c5873779-5257-4763-96cc-c2456ba31855	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	13B	ECONOMY	13	B	{}	f
712501db-9ae1-4677-bf49-afa1c108bf7c	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	13C	ECONOMY	13	C	{}	f
81f8f3e8-a4ff-4481-88ed-56d4f22e3c90	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	13D	ECONOMY	13	D	{}	f
cbea0b44-f70c-4d6e-b334-4e0f3ba8bf84	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	13E	ECONOMY	13	E	{}	f
a79215a2-4650-42c8-9b8e-f77dc97b3f0c	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	13F	ECONOMY	13	F	{}	f
9ccc38e1-1222-4afb-9512-cc2191350380	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	14A	ECONOMY	14	A	{}	f
22f9e827-363a-437d-ac75-8d6150ff0707	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	14B	ECONOMY	14	B	{}	f
f12246db-418c-457a-b924-e327627f3cc8	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	14C	ECONOMY	14	C	{}	f
165dfac5-79c5-4f1d-8504-146ab93680d6	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	14D	ECONOMY	14	D	{}	f
3d3b579d-a834-4e87-bfc2-c9448df3d523	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	14E	ECONOMY	14	E	{}	f
a574e2e8-315a-4a1c-85c8-70486a861372	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	14F	ECONOMY	14	F	{}	f
866b5a51-502e-465e-96de-2e7e34b1745c	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	15A	ECONOMY	15	A	{}	f
1ffcfbc5-525c-4832-9048-4cf15ffd72c3	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	15B	ECONOMY	15	B	{}	f
392d05e6-8623-4026-9f16-8c3411cb0cd8	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	15C	ECONOMY	15	C	{}	f
bf136538-0dc7-4ed3-995f-601a06e4f122	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	15D	ECONOMY	15	D	{}	f
9479f0cb-4fbd-4f85-95b3-ffacb5620ee9	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	15E	ECONOMY	15	E	{}	f
be9e7ab4-1230-4438-8379-96c32cbce7d6	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	15F	ECONOMY	15	F	{}	f
3b35f361-0373-4d79-a031-889717142f07	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	16A	ECONOMY	16	A	{}	f
ba1aeee2-2ded-47ab-a9fc-e1b79a7b1a93	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	16B	ECONOMY	16	B	{}	f
94a0cd64-92b6-44f0-a52f-797f6f6c3ad0	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	16C	ECONOMY	16	C	{}	f
afac4e41-1cfc-496d-8c23-d60c299e0480	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	16D	ECONOMY	16	D	{}	f
65a38ea5-82e0-4874-8d30-630af64725f1	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	16E	ECONOMY	16	E	{}	f
2caf12c4-0efa-4688-be3e-490a6164dedd	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	16F	ECONOMY	16	F	{}	f
382316db-c3ee-4360-a459-969b0c4cd04e	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	17A	ECONOMY	17	A	{}	f
ca0aaebb-ddd3-480f-8913-85101a828cfb	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	17B	ECONOMY	17	B	{}	f
d33bcce6-eb66-46fc-8b2c-00acdac31ef2	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	17C	ECONOMY	17	C	{}	f
9a7a26ee-483b-4d57-b6d6-f2f11bcef880	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	17D	ECONOMY	17	D	{}	f
82050737-807d-4d1d-8235-551dcb1e282a	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	17E	ECONOMY	17	E	{}	f
73520f00-f3cc-48cf-ba02-f480713bb731	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	17F	ECONOMY	17	F	{}	f
5e2b05ea-1c2b-4187-a8db-e907d3b5dad6	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	18A	ECONOMY	18	A	{}	f
b84801ae-7f7e-4405-b07f-d2d2758e9ba6	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	18B	ECONOMY	18	B	{}	f
f607c38a-f5fd-4563-96ef-165b432be798	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	18C	ECONOMY	18	C	{}	f
4fb24b8b-803f-4d88-8ac1-dad1867bad5b	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	18D	ECONOMY	18	D	{}	f
1572a4fb-9c98-4511-92a2-c86d54158ed3	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	18E	ECONOMY	18	E	{}	f
bd4a8eed-1772-4e43-b59f-164b5ab36a49	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	18F	ECONOMY	18	F	{}	f
b592906b-42ba-449a-a5ba-722e13aba43e	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	19A	ECONOMY	19	A	{}	f
e8dbb56d-2a3c-424f-8b90-15b244318c68	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	19B	ECONOMY	19	B	{}	f
d11c3c3a-d77e-4124-95ab-a2cfeb1b56bf	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	19C	ECONOMY	19	C	{}	f
746f0e10-1020-483f-a0fd-0bd4c88c6739	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	19D	ECONOMY	19	D	{}	f
281be415-9206-45ba-8dd0-5ded649e03c6	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	19E	ECONOMY	19	E	{}	f
d5d6c267-9163-4acb-b237-1925db5c256b	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	19F	ECONOMY	19	F	{}	f
bb0aafb6-0436-4148-9138-7a744aee80f1	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	20A	ECONOMY	20	A	{}	f
f317ef0e-1b1a-4d44-a31c-2cf0a8ee422b	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	20B	ECONOMY	20	B	{}	f
5850c8e3-0e8f-46fb-ac6b-d6fc5a97b141	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	20C	ECONOMY	20	C	{}	f
ac35834e-dbf3-4dc4-931d-e6b66cf9def7	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	20D	ECONOMY	20	D	{}	f
dc9b696e-d63e-4d4f-b118-976a87248e99	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	20E	ECONOMY	20	E	{}	f
7a5a0c65-8619-4ebd-b6e5-c6bec14216a8	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	20F	ECONOMY	20	F	{}	f
c7540ddd-4abb-4c1d-934c-0a893df3b0e1	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	21A	ECONOMY	21	A	{}	f
e8b9966b-806b-4272-a5b7-6e25e4a6ef53	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	21B	ECONOMY	21	B	{}	f
d19e2dc0-4dc6-4ae4-bb95-943c8d56e14d	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	21C	ECONOMY	21	C	{}	f
23d1537e-c92d-4090-a171-c51404d61ff8	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	21D	ECONOMY	21	D	{}	f
11f063a0-97d7-40ce-a87c-3e5bbd49ebee	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	21E	ECONOMY	21	E	{}	f
269c4bca-686f-4cb5-9895-c918d5200952	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	21F	ECONOMY	21	F	{}	f
d8dbcc30-bce8-41fb-868b-dbbf3d424b09	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	22A	ECONOMY	22	A	{}	f
006ab34e-26be-4d63-aad2-1b946303ee75	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	22B	ECONOMY	22	B	{}	f
24e038fd-fa1b-4c2c-9411-17a2babbc4e2	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	22C	ECONOMY	22	C	{}	f
c67cdce1-6454-43c1-94fe-d4fb093e6cb4	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	22D	ECONOMY	22	D	{}	f
5bd6d269-63a2-4d3d-935a-5f4cdde466f4	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	22E	ECONOMY	22	E	{}	f
c92307f0-198d-483f-a5bf-2a16480573ca	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	22F	ECONOMY	22	F	{}	f
bcee52ae-3504-4378-ac08-79a74e863e79	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	23A	ECONOMY	23	A	{}	f
ff77c603-4494-4197-8583-983f8f377905	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	23B	ECONOMY	23	B	{}	f
312d566f-32ea-433b-9246-60860bf17179	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	23C	ECONOMY	23	C	{}	f
26bde015-61c4-4246-bf43-538081effd33	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	23D	ECONOMY	23	D	{}	f
cc4aa5d3-fa45-46b7-a2f5-2e0a1bba0973	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	23E	ECONOMY	23	E	{}	f
47059239-598f-4ce1-8e47-72c77605d707	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	23F	ECONOMY	23	F	{}	f
ad15ca01-a5e7-4d4a-a835-edafc3cd9907	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	24A	ECONOMY	24	A	{}	f
4f4466ab-e753-4671-921d-9c0d0c0fa1da	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	24B	ECONOMY	24	B	{}	f
9c784fae-6ac2-4a2c-873b-966dc5899101	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	24C	ECONOMY	24	C	{}	f
a5d6d1bd-f486-4bd5-9a71-bb7e3069b200	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	24D	ECONOMY	24	D	{}	f
aa43ba4a-7908-49b4-b19a-b0f243638ec9	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	24E	ECONOMY	24	E	{}	f
4e73a093-60f6-4207-8499-4a30cb993733	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	24F	ECONOMY	24	F	{}	f
b6de4e65-4cfc-4718-ae68-f05bb03dea17	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	25A	ECONOMY	25	A	{}	t
8d8764d4-1923-4755-a6b9-09b4b5d1c30e	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	25B	ECONOMY	25	B	{}	t
fb6e6c92-81c5-4f15-b73c-da82410eba88	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	25C	ECONOMY	25	C	{}	t
9c4309f9-3e37-462e-9e67-304d2e7ad8b8	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	25D	ECONOMY	25	D	{}	t
f2fca4e7-9e06-4e21-816e-a9cc7c0a58ff	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	25E	ECONOMY	25	E	{}	t
e355fc8c-529b-4c4c-b7a4-dc95a5181bc2	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	25F	ECONOMY	25	F	{}	t
f5617029-2ac4-4106-8520-56c2e7d7a48c	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	26A	ECONOMY	26	A	{}	f
4090ac50-dd3d-4e2e-9432-3510b401e08f	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	26B	ECONOMY	26	B	{}	f
abc8bf1c-97e6-491c-a7bc-00a07d2bc727	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	26C	ECONOMY	26	C	{}	f
42bf13c1-9c38-457a-8483-9624107297d9	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	26D	ECONOMY	26	D	{}	f
f7af70cc-66af-4d01-966f-611c6f30839f	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	26E	ECONOMY	26	E	{}	f
38c6a27c-4518-4f80-8e2c-8dfc95a1b459	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	26F	ECONOMY	26	F	{}	f
005fb8aa-046a-4bdf-b762-95248658be23	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	27A	ECONOMY	27	A	{}	f
f006c248-e83d-4241-81ab-e238451ec53a	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	27B	ECONOMY	27	B	{}	f
8d4135cb-b1a3-4289-a882-ada8cb5c3834	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	27C	ECONOMY	27	C	{}	f
c3550051-fa24-4cb8-b738-a550cf4f960a	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	27D	ECONOMY	27	D	{}	f
25e18d4e-c092-4e7e-ac08-549816484e41	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	27E	ECONOMY	27	E	{}	f
62e4038d-0303-4c6e-a79e-4df9861a432a	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	27F	ECONOMY	27	F	{}	f
6659c5e5-4faf-456e-a1b8-44c405752668	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	28A	ECONOMY	28	A	{}	f
f0cb5cfa-f516-488e-8d66-65e7311ab135	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	28B	ECONOMY	28	B	{}	f
c049f8b7-c1e5-4c42-aaee-bc5a0cb37e55	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	28C	ECONOMY	28	C	{}	f
c9aca285-692c-41da-9a6f-ec506c0e36de	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	28D	ECONOMY	28	D	{}	f
72709b13-fbc2-4e8c-bd9c-23b5f43cc8a0	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	28E	ECONOMY	28	E	{}	f
7002a447-0273-47fc-8491-398312882782	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	28F	ECONOMY	28	F	{}	f
d6220ce6-8bb6-41a9-9020-57fa3606f562	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	29A	ECONOMY	29	A	{}	f
562b9785-b3f5-455b-b31d-4c5b807ed261	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	29B	ECONOMY	29	B	{}	f
5ed21606-d663-4b66-9e9f-11c117f21a2a	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	29C	ECONOMY	29	C	{}	f
48d99546-d253-4e87-a76c-b8bd712711a0	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	29D	ECONOMY	29	D	{}	f
10bfcc52-c289-498c-97a9-1295820f929f	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	29E	ECONOMY	29	E	{}	f
38245e03-0d94-4785-97fd-edb3847437bb	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	29F	ECONOMY	29	F	{}	f
134b58ed-52f1-4aa3-bdd1-13b86291196a	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	30A	ECONOMY	30	A	{}	f
95d310d2-368e-497b-a779-b813a18d4e73	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	30B	ECONOMY	30	B	{}	f
52cc6d23-c185-43de-ab44-e58ea375217e	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	30C	ECONOMY	30	C	{}	f
7a8f23e8-b406-4d3c-ae73-2212eae98007	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	30D	ECONOMY	30	D	{}	f
3ea01183-a8d9-42aa-8ac2-de9965d0814e	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	30E	ECONOMY	30	E	{}	f
16ce2744-d142-4cc9-8313-f3d7611fc500	a3e2f7af-97f8-4652-a343-3a7e72b6fb78	30F	ECONOMY	30	F	{}	f
6ed4a592-886e-418e-ab34-d3c8af8ab3d6	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	1A	BUSINESS	1	A	{}	f
b5e9b889-67d1-478c-bc89-fee99a4cdeb1	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	1B	BUSINESS	1	B	{}	f
a2a51db7-2158-4920-992d-87024acc7aea	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	1C	BUSINESS	1	C	{}	f
d2401755-7529-4f02-ab12-0d2e807a0781	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	1D	BUSINESS	1	D	{}	f
3db60fa2-8772-46a9-a3cb-fb2b58c609aa	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	1E	BUSINESS	1	E	{}	f
198d3aa7-52e0-43f0-856b-705d5e97b33e	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	1F	BUSINESS	1	F	{}	f
c41c2ce2-291e-40d2-ad3e-be4dac52e86d	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2A	BUSINESS	2	A	{}	f
39c9495e-6ef9-4251-bdfc-10227997fefa	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2B	BUSINESS	2	B	{}	f
7dfa3478-ac33-474d-89c7-08fe1f885222	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2C	BUSINESS	2	C	{}	f
9741ad09-229a-46c8-b2c7-c27d1a788f4e	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2D	BUSINESS	2	D	{}	f
42b62bf7-a42d-4a31-8118-c77cecb84910	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2E	BUSINESS	2	E	{}	f
630fdcc0-ed67-4c03-b0b0-974ea6fc2720	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	2F	BUSINESS	2	F	{}	f
abcba75e-57ce-4557-8090-36a93346c3b5	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	3A	BUSINESS	3	A	{}	f
ded2faa3-5d85-4bfa-beb3-250a37f73191	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	3B	BUSINESS	3	B	{}	f
fbff7743-b4b8-4050-a377-038a171bf1d6	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	3C	BUSINESS	3	C	{}	f
ef14b291-b377-4b6e-9ae6-0651a7bf9db9	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	3D	BUSINESS	3	D	{}	f
0e1e61fc-8823-41a7-8797-da35ce1474eb	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	3E	BUSINESS	3	E	{}	f
ec83af67-81cd-4bdc-822d-dd1d4a86064e	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	3F	BUSINESS	3	F	{}	f
33426daa-7dbe-46e5-ae1c-b87ad5102e61	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	4A	BUSINESS	4	A	{}	f
92f7b1e2-c047-47b6-983d-939df0566668	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	4B	BUSINESS	4	B	{}	f
9dee7ee3-dadc-48c3-8ef5-c02d9a6da378	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	4C	BUSINESS	4	C	{}	f
4051f4fc-4199-4257-aba9-79c8ed696ad8	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	4D	BUSINESS	4	D	{}	f
ba202295-edeb-475e-a85a-378daa9f94df	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	4E	BUSINESS	4	E	{}	f
0791925c-fac2-4a54-91dc-1486467e0c6c	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	4F	BUSINESS	4	F	{}	f
14cda2a8-c45f-45d5-9270-f4fafaa34e90	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	5A	BUSINESS	5	A	{}	f
b0bda61a-ce12-4cfd-902f-d2f2125bd119	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	5B	BUSINESS	5	B	{}	f
a669a5ae-1996-49de-bbc5-d9b017ca8f33	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	5C	BUSINESS	5	C	{}	f
8c8de7e4-894c-41f7-9db0-605b19862dad	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	5D	BUSINESS	5	D	{}	f
541cb841-8edf-4dbf-80de-debe6b91606f	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	5E	BUSINESS	5	E	{}	f
edad2046-5c59-4b32-9c98-f5ca27913f2e	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	5F	BUSINESS	5	F	{}	f
a98ca171-030c-4350-b18a-a066cf91af03	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	6A	BUSINESS	6	A	{}	f
26f088e0-d81a-4b77-9e9f-e5ebc5c0781d	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	6B	BUSINESS	6	B	{}	f
1f80ad71-11a6-4c9c-bb0d-992914adaeb5	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	6C	BUSINESS	6	C	{}	f
58f1a93f-5122-4102-ba32-8dd7ead6efdc	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	6D	BUSINESS	6	D	{}	f
f63f4611-3cda-46a4-9c20-021235fd5d6b	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	6E	BUSINESS	6	E	{}	f
34031b65-2220-4f23-bfe8-4d52760492d5	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	6F	BUSINESS	6	F	{}	f
57986a8e-dc4a-468a-9127-092f9b92d50a	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	7A	ECONOMY	7	A	{}	f
fdef9fcd-ba62-4347-b1c7-0d1081a5e854	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	7B	ECONOMY	7	B	{}	f
82bd664c-105e-4118-923c-99c21a5e445c	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	7C	ECONOMY	7	C	{}	f
a16ede34-1e54-4c50-a650-f6efc6ad159a	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	7D	ECONOMY	7	D	{}	f
268e83ff-1f93-4bf4-8444-ab8b669511f4	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	7E	ECONOMY	7	E	{}	f
e8870aac-d2f8-4e70-8382-e4caacdfd579	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	7F	ECONOMY	7	F	{}	f
1cbeeb89-7ae0-4d0a-8f89-e711d23965bd	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	8A	ECONOMY	8	A	{}	f
a32f2530-8d0c-4528-9d5e-793781ec0cb1	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	8B	ECONOMY	8	B	{}	f
9c7da966-c3c0-4374-9f0f-c58d85f93404	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	8C	ECONOMY	8	C	{}	f
1f025ca4-6c03-4497-9396-d6327b3c89d2	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	8D	ECONOMY	8	D	{}	f
783cc766-ce35-4bff-824c-b286b1e60504	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	8E	ECONOMY	8	E	{}	f
9b8b43a1-836c-4a93-87c0-391205198d3a	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	8F	ECONOMY	8	F	{}	f
a445102d-3ff6-4c85-931b-912b8630cebc	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	9A	ECONOMY	9	A	{}	f
ebd54cf0-9863-48b9-9415-51424101576d	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	9B	ECONOMY	9	B	{}	f
90707c53-3598-45f4-a029-3eb00fb02cac	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	9C	ECONOMY	9	C	{}	f
37c6f0ab-58aa-40fb-8ea6-8a68b7c0223a	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	9D	ECONOMY	9	D	{}	f
bbb2361e-a4da-4d40-8615-a3722d3de4b2	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	9E	ECONOMY	9	E	{}	f
3dfdfc34-af00-4068-9062-cb885c15aad0	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	9F	ECONOMY	9	F	{}	f
8d969a0e-0175-4e7c-be59-477d7bda8adb	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	10A	ECONOMY	10	A	{}	f
105c16ed-3e2f-40eb-a589-854718d90b3d	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	10B	ECONOMY	10	B	{}	f
69c0f92d-7bd1-43d2-847a-87abb7d602c2	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	10C	ECONOMY	10	C	{}	f
bc4b0dd4-bff6-4431-b35f-cfd42975a643	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	10D	ECONOMY	10	D	{}	f
90f8543e-fca1-4c7c-8b5f-541de86a7e4e	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	10E	ECONOMY	10	E	{}	f
af24cb33-f53a-4e5a-bd6d-8ad53a3a5aa2	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	10F	ECONOMY	10	F	{}	f
c23b0b88-f649-43e6-87d3-0a736323c9c6	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	11A	ECONOMY	11	A	{}	f
4124de90-de2c-4039-ab3c-c095c716b4d9	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	11B	ECONOMY	11	B	{}	f
23f0fc30-d9bc-4350-983d-72438c39e8f9	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	11C	ECONOMY	11	C	{}	f
cb2b548c-1747-4143-8d89-aed6a659c3ef	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	11D	ECONOMY	11	D	{}	f
4839ae4e-2ebc-4ab3-b739-0ae6ff0d0415	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	11E	ECONOMY	11	E	{}	f
0ea4ba90-46b8-4e5b-849d-47425bcf4ae4	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	11F	ECONOMY	11	F	{}	f
370dbeb5-5793-48ba-9743-ff24d9906434	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	12A	ECONOMY	12	A	{}	t
0d910e2d-d133-4c5b-93be-7b590d20271f	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	12B	ECONOMY	12	B	{}	t
cd36d2d4-5d68-446b-aa89-bc651b80535e	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	12C	ECONOMY	12	C	{}	t
ae5c9116-b884-4286-a0c5-72a215e57f08	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	12D	ECONOMY	12	D	{}	t
9ade7b0c-e040-4c70-a052-c4eba02843d1	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	12E	ECONOMY	12	E	{}	t
76268262-0581-4f42-9559-21acda741835	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	12F	ECONOMY	12	F	{}	t
19dd8d1a-92f2-4b15-8ffa-293e3acc0867	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	13A	ECONOMY	13	A	{}	f
0f9c080c-7893-456e-82d4-39e1f99fe1b2	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	13B	ECONOMY	13	B	{}	f
96c6b693-9bc2-4641-819c-9de9e27edbb9	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	13C	ECONOMY	13	C	{}	f
3de2b68f-beea-445d-a046-7d6045b9b0e3	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	13D	ECONOMY	13	D	{}	f
8596a8d4-6a34-4ba8-aaec-dae3510032bd	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	13E	ECONOMY	13	E	{}	f
a0dd00e5-6c22-4629-aa3e-1be765d7962e	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	13F	ECONOMY	13	F	{}	f
8bfcb8d5-3550-4ea5-94f8-9085ddda44a9	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	14A	ECONOMY	14	A	{}	f
2ceb718a-6be4-40aa-98b3-739f444d53c9	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	14B	ECONOMY	14	B	{}	f
aa6caf87-b67e-4770-adb6-d0ecd9c7ee0c	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	14C	ECONOMY	14	C	{}	f
52534375-1b05-4d48-8b47-5ee9d6ad828b	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	14D	ECONOMY	14	D	{}	f
c5d3fc69-f640-4e5f-85a1-b40f0c8a1ff4	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	14E	ECONOMY	14	E	{}	f
3c6805c9-296b-4bae-b0bf-61632c994da1	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	14F	ECONOMY	14	F	{}	f
8cff1270-8462-4951-97d0-a05f0ff57f3a	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	15A	ECONOMY	15	A	{}	f
ea402121-d7a5-4f60-b664-95c93f7c5d54	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	15B	ECONOMY	15	B	{}	f
3f1d3256-fcdf-4814-9890-1bdffc94000d	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	15C	ECONOMY	15	C	{}	f
9deb61e0-969b-43f6-87e6-b77808532d74	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	15D	ECONOMY	15	D	{}	f
a44a6c91-5f08-4193-8f23-658a40035ada	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	15E	ECONOMY	15	E	{}	f
954375f5-b61c-4e55-a085-a3acb4008326	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	15F	ECONOMY	15	F	{}	f
28bfff74-0f6e-496e-98b5-9227451404fd	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	16A	ECONOMY	16	A	{}	f
fdbba3d2-af34-45cc-9633-61f815b791e8	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	16B	ECONOMY	16	B	{}	f
a7ed9c5d-d0d1-419d-86ef-a5037bc350e7	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	16C	ECONOMY	16	C	{}	f
e78606e6-6b3c-475e-b7bc-add89b4b12b4	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	16D	ECONOMY	16	D	{}	f
58987af5-f4b3-4864-b594-a4c243588ef2	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	16E	ECONOMY	16	E	{}	f
09bfca1c-ab97-4408-bce4-aee0e4fa6b52	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	16F	ECONOMY	16	F	{}	f
83b06549-6586-420f-81f9-997cbf33dfb9	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	17A	ECONOMY	17	A	{}	f
144cad94-c1a5-4a1e-a711-ee10aaae4c86	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	17B	ECONOMY	17	B	{}	f
c8b4e0e0-1abb-4cc5-825d-11e2f5f74002	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	17C	ECONOMY	17	C	{}	f
ae71a212-3e43-41a0-be4f-682aa1069105	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	17D	ECONOMY	17	D	{}	f
6d5fd7c7-c5f3-467c-85ab-d5d20c6574f6	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	17E	ECONOMY	17	E	{}	f
f320a2c0-c7d0-4d2e-8a1a-15a41fc1abe3	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	17F	ECONOMY	17	F	{}	f
4557faf3-9a76-4abe-b38d-3c9a8ac7d40c	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	18A	ECONOMY	18	A	{}	f
b02afd83-c4ed-4a2f-a21b-c5e641163daf	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	18B	ECONOMY	18	B	{}	f
fbb6e508-f122-4f00-9193-150b4679a88a	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	18C	ECONOMY	18	C	{}	f
8b858c86-ac87-41be-aa51-50aaac10e1f7	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	18D	ECONOMY	18	D	{}	f
b2836575-d05f-400c-9eaf-f6f7859f4771	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	18E	ECONOMY	18	E	{}	f
0d239719-7e1d-403d-91bc-f19548bab8ff	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	18F	ECONOMY	18	F	{}	f
8273d773-61e1-4a44-a315-e384e0d10194	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	19A	ECONOMY	19	A	{}	f
700f84db-2612-4185-8dd7-037dab5d3356	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	19B	ECONOMY	19	B	{}	f
bcd1dc5a-114d-4899-a23e-d4eae80ccfdb	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	19C	ECONOMY	19	C	{}	f
7b598c6c-fca0-48fe-b4e4-5b185b81c964	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	19D	ECONOMY	19	D	{}	f
4c0e8f7f-93a5-49d8-98bd-246147bbed2a	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	19E	ECONOMY	19	E	{}	f
f09bea72-398a-46c9-9836-658aed6241bb	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	19F	ECONOMY	19	F	{}	f
20555963-d9ac-400c-9ebd-dda246b5d9ee	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	20A	ECONOMY	20	A	{}	f
52bf7a16-6ad5-4170-ba4b-d7d8e0c18aef	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	20B	ECONOMY	20	B	{}	f
4175f109-ed69-4ea6-a093-1b527885cede	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	20C	ECONOMY	20	C	{}	f
8995a82e-23a6-40fb-8cb8-cc573f5a7513	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	20D	ECONOMY	20	D	{}	f
3f347b2a-93fc-4b8a-ba9c-eafe8b171705	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	20E	ECONOMY	20	E	{}	f
9f4a5582-6b04-491b-b4d0-3975affe8a34	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	20F	ECONOMY	20	F	{}	f
dd46150a-f07a-4d37-a947-60c22a716c43	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	21A	ECONOMY	21	A	{}	f
3bc6bbe0-14f1-4bec-9231-9bdc2217bf86	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	21B	ECONOMY	21	B	{}	f
94e21b93-a704-4ca4-af30-32bee4b906fe	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	21C	ECONOMY	21	C	{}	f
62ae984b-71a1-43c4-aac6-da46f54fe74b	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	21D	ECONOMY	21	D	{}	f
c1a8ed37-fd73-4938-b40e-b69c7625c490	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	21E	ECONOMY	21	E	{}	f
e0c15aea-ebf0-40c9-8281-0939c677a961	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	21F	ECONOMY	21	F	{}	f
d2bc1b44-bb7e-429f-8187-6e34a1c1bc44	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	22A	ECONOMY	22	A	{}	f
18f470f2-23b5-4be9-9246-23a90acca392	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	22B	ECONOMY	22	B	{}	f
d66f6929-0ab9-4e4e-97bd-a8c8ca1e28bf	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	22C	ECONOMY	22	C	{}	f
7e37ce21-b90e-4d67-b468-864e946e1328	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	22D	ECONOMY	22	D	{}	f
0842bab1-6468-4d45-a953-0c49972092b3	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	22E	ECONOMY	22	E	{}	f
e9f0e0d8-4df2-478a-897d-7fe3a69e39cf	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	22F	ECONOMY	22	F	{}	f
7d750a35-7aae-43da-96d7-d733f1fef2c6	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	23A	ECONOMY	23	A	{}	f
303fe63d-0da0-44cf-bd10-3a80a919d9ec	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	23B	ECONOMY	23	B	{}	f
ae01fd1e-f319-42a5-b7a7-97eb2730ac3e	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	23C	ECONOMY	23	C	{}	f
6c389eb7-1605-48a7-995d-e0279e29ff19	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	23D	ECONOMY	23	D	{}	f
1f8c2e66-4542-47d6-903c-22dd697ccf62	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	23E	ECONOMY	23	E	{}	f
b17e59bc-e632-413a-9fa0-fb93e9a5b0a3	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	23F	ECONOMY	23	F	{}	f
77b088d0-e79a-46b9-97f5-79e7d59e3f91	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	24A	ECONOMY	24	A	{}	f
1510e196-035f-4403-ba87-f6b90775b7e3	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	24B	ECONOMY	24	B	{}	f
bcf6a3d7-bdb9-4724-9517-037030f40fbc	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	24C	ECONOMY	24	C	{}	f
11286c0b-e373-4997-a566-5b0788a2cbc1	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	24D	ECONOMY	24	D	{}	f
ebed7acd-16be-4868-bc75-653a0b2e0743	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	24E	ECONOMY	24	E	{}	f
a570e686-624e-4c43-90bd-9b3294202e1f	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	24F	ECONOMY	24	F	{}	f
30bfac1c-cbf4-4dcc-bfd2-3f54470e5d73	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	25A	ECONOMY	25	A	{}	t
3c30cc7a-f547-49a6-bff0-dc768ae75561	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	25B	ECONOMY	25	B	{}	t
564dccda-f691-4a9e-bdec-aa4d02f5f78e	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	25C	ECONOMY	25	C	{}	t
f801a63b-1e81-454b-961a-45247b3644bd	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	25D	ECONOMY	25	D	{}	t
43cb0937-9402-4d91-9f49-f3ce647765a0	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	25E	ECONOMY	25	E	{}	t
f897f265-8f60-47f6-9f3f-742d132b97a6	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	25F	ECONOMY	25	F	{}	t
e5611511-77c2-485f-a344-d18d2df56918	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	26A	ECONOMY	26	A	{}	f
880a54f7-de10-4963-879e-c5509a509635	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	26B	ECONOMY	26	B	{}	f
d2c685dd-7951-4555-bd94-d8a13f73c05a	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	26C	ECONOMY	26	C	{}	f
f3f2781e-9d8a-4fd8-9ac6-f625e7c301d0	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	26D	ECONOMY	26	D	{}	f
06aa55d0-5e7a-4a4c-8230-d2aaa73ef214	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	26E	ECONOMY	26	E	{}	f
1c6d654b-57ec-446f-8c02-19ab50c06060	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	26F	ECONOMY	26	F	{}	f
4cd76331-31c9-410d-8ce9-beaa8e2a03ae	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	27A	ECONOMY	27	A	{}	f
21887251-2169-4913-a7ac-867a1285bd23	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	27B	ECONOMY	27	B	{}	f
6aeb2c23-2b07-408b-b08f-4dc3d0c3ef68	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	27C	ECONOMY	27	C	{}	f
4df0139f-ec60-41b4-b705-66504e710e15	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	27D	ECONOMY	27	D	{}	f
99829e41-ad06-4bd5-90bf-63ad33ac74f2	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	27E	ECONOMY	27	E	{}	f
c1173b7b-ab7a-433f-986f-5e05febe0682	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	27F	ECONOMY	27	F	{}	f
24057ec5-abe3-4f21-ab5e-cf45424c8c3d	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	28A	ECONOMY	28	A	{}	f
8d0ae8db-3d84-4833-b661-bbcc9a1d59b5	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	28B	ECONOMY	28	B	{}	f
069c1195-a99a-4f93-a10d-735bf53d54ae	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	28C	ECONOMY	28	C	{}	f
456df8db-be66-437f-b5f2-82994f539764	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	28D	ECONOMY	28	D	{}	f
30a1954a-6def-43cb-af05-b37ffe619959	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	28E	ECONOMY	28	E	{}	f
fc8bb4a5-a79c-4727-b221-f7f8342c84a0	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	28F	ECONOMY	28	F	{}	f
ba801c99-f8a6-457d-8afd-974de23625d2	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	29A	ECONOMY	29	A	{}	f
09e9f0e2-663f-43cc-a98c-da339320ca3e	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	29B	ECONOMY	29	B	{}	f
1f743785-524f-4639-a2e0-10bae4e7a9f7	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	29C	ECONOMY	29	C	{}	f
85391dba-d2bb-45af-81e1-1e5d235c0968	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	29D	ECONOMY	29	D	{}	f
99328df2-33cd-4242-8cce-4c1464d459fb	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	29E	ECONOMY	29	E	{}	f
d3c503db-bfa5-47bd-baba-49b56f159076	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	29F	ECONOMY	29	F	{}	f
b885ad09-1f89-418d-9fd4-629e5d9b75b7	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	30A	ECONOMY	30	A	{}	f
0614b991-bf70-4334-a939-6932f98705f7	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	30B	ECONOMY	30	B	{}	f
2ce21c82-6075-44a4-b66e-814f39031a2e	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	30C	ECONOMY	30	C	{}	f
c3bb6898-9b97-4b75-bf81-dc3bdee74e01	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	30D	ECONOMY	30	D	{}	f
ebb0e8f8-7015-4226-a7ff-d1ce40c42364	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	30E	ECONOMY	30	E	{}	f
08fd624d-8baf-4026-8a7f-2c567fccc631	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	30F	ECONOMY	30	F	{}	f
5ded1d3a-472c-4921-832b-d707cd57b2d9	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	31A	ECONOMY	31	A	{}	f
a5aa9ea5-2e1b-4a10-9dc0-11d0d91840de	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	31B	ECONOMY	31	B	{}	f
5c42a577-491a-43da-937f-a878ac14116e	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	31C	ECONOMY	31	C	{}	f
6c10aaac-14b0-4924-b2b9-a49bf3b405c5	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	31D	ECONOMY	31	D	{}	f
2400f808-68e0-4b7b-880e-8025e93980e5	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	31E	ECONOMY	31	E	{}	f
01b6adaa-759c-4a11-85a3-7ecf91b5be67	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	31F	ECONOMY	31	F	{}	f
cc5cbcbe-1cfb-450f-b6bb-e813325b6971	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	32A	ECONOMY	32	A	{}	f
cd722124-5c0b-43f1-bc7e-38fa1cb617c5	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	32B	ECONOMY	32	B	{}	f
bdf3bb85-acad-4e0a-9ffe-f6e1cd1b49e0	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	32C	ECONOMY	32	C	{}	f
aeb5783d-bab8-40b9-a397-8a5121cef14c	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	32D	ECONOMY	32	D	{}	f
df638a38-aafc-424e-955b-93d60e949232	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	32E	ECONOMY	32	E	{}	f
87d485c6-6840-4edf-b014-b30e14090b8b	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	32F	ECONOMY	32	F	{}	f
7421306d-83ea-4ea6-a433-3d96d420cf44	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	33A	ECONOMY	33	A	{}	f
62ba67ea-ca0a-47d3-a2b2-cc2734186bba	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	33B	ECONOMY	33	B	{}	f
ec149cf9-ceaf-4d8c-be74-872c73e85744	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	33C	ECONOMY	33	C	{}	f
8dc15ea7-5217-4678-9d9a-9afdab741290	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	33D	ECONOMY	33	D	{}	f
e17babf7-1fda-4d4c-b714-7eb3230aca15	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	33E	ECONOMY	33	E	{}	f
be0ad690-1c02-4aed-b0f4-111a77106f76	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	33F	ECONOMY	33	F	{}	f
5642fbfe-d408-4d86-82c8-c4995cfce151	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	34A	ECONOMY	34	A	{}	f
dcb93e61-2494-4464-be66-4478aa74ef43	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	34B	ECONOMY	34	B	{}	f
3f4b28eb-1538-4ca5-8f69-0346dbbc3903	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	34C	ECONOMY	34	C	{}	f
594113d7-8782-482d-85b3-0cf694de25ef	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	34D	ECONOMY	34	D	{}	f
fbf96ca8-1bd1-49bd-a7d8-0f216eacb4df	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	34E	ECONOMY	34	E	{}	f
d456115e-6cf7-464a-8dea-ec998fcf4307	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	34F	ECONOMY	34	F	{}	f
8ed12535-a4aa-494f-b09d-706beadbbd0f	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	35A	ECONOMY	35	A	{}	f
1c2dc19c-f995-499b-b7ea-6d3bcf0f812a	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	35B	ECONOMY	35	B	{}	f
24097ac5-23d6-4aa8-aaa1-2a9fbfaa7a5b	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	35C	ECONOMY	35	C	{}	f
809cb564-8bc4-4187-a602-b08edc418d18	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	35D	ECONOMY	35	D	{}	f
6d0f80ad-d998-403f-8a6f-5f1384ec6292	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	35E	ECONOMY	35	E	{}	f
c6cfdf93-d04c-487d-9d4b-46c02e63a47c	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	35F	ECONOMY	35	F	{}	f
a8955da8-ede9-46ae-838f-58e1cde2cccd	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	36A	ECONOMY	36	A	{}	f
0638c1a2-0ad8-48d9-a38f-b4908c204023	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	36B	ECONOMY	36	B	{}	f
39d7bdae-0c24-4c48-9311-872398854661	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	36C	ECONOMY	36	C	{}	f
6dc5f57f-d4c8-4809-85ad-04e63266da29	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	36D	ECONOMY	36	D	{}	f
8d3714d5-334f-4e14-a033-d7644d309423	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	36E	ECONOMY	36	E	{}	f
e264235e-9824-4985-9efc-30c9e4805798	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	36F	ECONOMY	36	F	{}	f
52ea7826-a0ea-4ba4-b22e-06f614195c6a	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	37A	ECONOMY	37	A	{}	f
3cf63a9f-5724-4cb0-8238-34485085a7aa	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	37B	ECONOMY	37	B	{}	f
920bc3b5-d759-4792-9bff-91b345c20716	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	37C	ECONOMY	37	C	{}	f
ed2d6382-2060-496e-8670-97fa2808e203	a21552b8-ad8c-4320-ad0b-dbfb73948ae2	37D	ECONOMY	37	D	{}	f
25442484-9bfe-4bfe-8904-7223722ac731	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	1A	FIRST	1	A	{}	f
77e8e471-e3b9-47b4-819c-8730cb02ef03	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	1B	FIRST	1	B	{}	f
4a7b142c-a78b-4cfa-ad63-b02964eccc83	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	1C	FIRST	1	C	{}	f
37d8c898-ad51-4405-ae4a-ad1fda83b596	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	1D	FIRST	1	D	{}	f
8415ada8-5b38-451f-98c8-094bdffc760b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	1E	FIRST	1	E	{}	f
3956c119-4754-42f4-89df-56e022c3badb	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	1F	FIRST	1	F	{}	f
23f1cbbb-c31c-4047-81fa-1997936300b7	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2A	FIRST	2	A	{}	f
ec22f9c2-1619-4187-8eba-c97c2581cf3f	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2B	FIRST	2	B	{}	f
c3636f73-6afb-430c-b1f5-892090b63dff	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2C	FIRST	2	C	{}	f
3d7b5a73-bc58-4034-a9ad-7f96f42fd046	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2D	FIRST	2	D	{}	f
5a9a9319-c120-4e63-a69b-bea1fd7dd437	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2E	FIRST	2	E	{}	f
c05deff5-6939-403f-91f1-16ee680582bc	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	2F	FIRST	2	F	{}	f
31f40b2a-62b4-4c60-9182-ce29192e504e	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	3A	BUSINESS	3	A	{}	f
e1e49e30-ff3c-4398-b402-adf9493c11dd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	3B	BUSINESS	3	B	{}	f
bc74ffcd-fbcd-4ac8-bd41-08fd303fe289	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	3C	BUSINESS	3	C	{}	f
bcbc2259-61d3-434b-96c0-ab279909b8f9	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	3D	BUSINESS	3	D	{}	f
5f9eede4-942e-49ff-93fb-d4f8928c6b78	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	3E	BUSINESS	3	E	{}	f
b5ba8413-ba19-43f2-9485-99b23be9c67c	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	3F	BUSINESS	3	F	{}	f
40609519-dcd5-49a3-94e5-6c997b1c693d	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	4A	BUSINESS	4	A	{}	f
8af65bd0-a5eb-4eb6-896c-8f37f7863055	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	4B	BUSINESS	4	B	{}	f
0bef0d5c-e2ae-494c-b03a-4c75ef88244c	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	4C	BUSINESS	4	C	{}	f
24eccc17-49ff-4974-a519-405c9d6ecacc	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	4D	BUSINESS	4	D	{}	f
2d6db98b-75d2-4391-829c-8974503ac6ef	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	4E	BUSINESS	4	E	{}	f
92bb32b8-6328-43e3-8cbd-3ba9132e0947	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	4F	BUSINESS	4	F	{}	f
cb7fb6d0-ebf7-4602-9ccc-183c21ee8c77	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	5A	BUSINESS	5	A	{}	f
77d7b62a-3ea9-495e-bf3f-5a35f73daf24	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	5B	BUSINESS	5	B	{}	f
b5a527da-e1fd-4d73-bef5-0043b9b883a1	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	5C	BUSINESS	5	C	{}	f
c65e0d87-bec8-4b99-97fe-6278fe9933c1	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	5D	BUSINESS	5	D	{}	f
77979718-cd5c-41ce-8134-6e1b69581719	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	5E	BUSINESS	5	E	{}	f
53d23470-3ff6-44a8-ba5f-fb1fba5fc6d5	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	5F	BUSINESS	5	F	{}	f
9879fdd3-4df3-41d0-97f9-1a2f74978a24	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	6A	BUSINESS	6	A	{}	f
fc849789-944f-4f21-8125-04b32afca35f	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	6B	BUSINESS	6	B	{}	f
1960bba8-47d2-43aa-a04e-3304128b9dc9	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	6C	BUSINESS	6	C	{}	f
37e5a9bd-bfb5-4855-9078-0578f37db8d7	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	6D	BUSINESS	6	D	{}	f
d8ee1e92-148c-46b9-9210-16daf07a513e	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	6E	BUSINESS	6	E	{}	f
c54930b2-068c-4dbb-9012-30704e8c7c17	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	6F	BUSINESS	6	F	{}	f
e0b4f6e2-6b32-4dc2-9311-f9286f2c502e	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	7A	ECONOMY	7	A	{}	f
ed2c54c0-512a-4c48-aaa2-393b4697764a	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	7B	ECONOMY	7	B	{}	f
03c568ea-4c08-4b11-997e-cb6fafbfbda0	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	7C	ECONOMY	7	C	{}	f
4c29c405-2dc9-4509-9eea-5bd1819f033d	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	7D	ECONOMY	7	D	{}	f
c710ca43-7d03-4bcd-a9e6-a912bb0931e6	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	7E	ECONOMY	7	E	{}	f
26406e45-0f31-4d6e-beaa-f2c8a8d6699f	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	7F	ECONOMY	7	F	{}	f
ac797a46-8243-4574-9cc4-060c370168ea	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	8A	ECONOMY	8	A	{}	f
64a68592-40bb-4c7f-8c50-000daf6acb84	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	8B	ECONOMY	8	B	{}	f
bcb37ab5-3769-4907-84a0-9a28455e14fd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	8C	ECONOMY	8	C	{}	f
367f06d3-7cc3-4a38-849d-821e395b370b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	8D	ECONOMY	8	D	{}	f
a3ee47ab-f61b-436a-9e7c-ac2f76894447	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	8E	ECONOMY	8	E	{}	f
5c1c8c79-6eff-4509-ab51-8444b3227749	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	8F	ECONOMY	8	F	{}	f
c385bd02-7aec-49d4-8946-c36c9bc0fff3	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	9A	ECONOMY	9	A	{}	f
49db48d5-3efa-4491-a92c-95052ac38891	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	9B	ECONOMY	9	B	{}	f
de240c70-ac5d-457d-96fa-457858ae10df	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	9C	ECONOMY	9	C	{}	f
e2689d88-fa18-4d2f-a8bd-4313824b55ce	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	9D	ECONOMY	9	D	{}	f
38d47151-0ae9-40ae-9518-7e5804ef14ec	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	9E	ECONOMY	9	E	{}	f
e9948354-ed2c-42a9-9be4-f6c1b84a3cde	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	9F	ECONOMY	9	F	{}	f
26680215-c478-4dfd-b8f4-cdb806d89494	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	10A	ECONOMY	10	A	{}	f
298785d3-4462-4a44-bd6e-3fb96b5ec60b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	10B	ECONOMY	10	B	{}	f
ad411054-c827-455b-9492-2f2c3ab8bb4a	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	10C	ECONOMY	10	C	{}	f
35cc56e6-2ff7-4b82-abf4-33bb8ad07e25	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	10D	ECONOMY	10	D	{}	f
bf14901d-8830-42be-b79d-c12caf497ffa	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	10E	ECONOMY	10	E	{}	f
1dadc151-bdf6-46ba-b373-17b4a5035b21	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	10F	ECONOMY	10	F	{}	f
b1994ea5-d075-47e5-abb0-a1aa5013710b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	11A	ECONOMY	11	A	{}	f
515d4c7c-45a7-47ea-a114-d7aedfedb7fe	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	11B	ECONOMY	11	B	{}	f
c5ae81d6-0d0a-4d92-9370-fc64835196f6	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	11C	ECONOMY	11	C	{}	f
5b54f689-b96e-422f-981b-7434f5b86317	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	11D	ECONOMY	11	D	{}	f
b74a3a89-e165-417b-a827-5b2eab38c349	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	11E	ECONOMY	11	E	{}	f
0e974dfe-e388-4ba9-bb94-181fcb6a16b9	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	11F	ECONOMY	11	F	{}	f
86d0ba10-3af9-42b7-82bc-0ee86b52522e	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	12A	ECONOMY	12	A	{}	t
4c1d377b-a992-4996-81d4-ec3e96ceae96	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	12B	ECONOMY	12	B	{}	t
2b0a8c35-f52a-42cd-87bf-f955c9ec39b3	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	12C	ECONOMY	12	C	{}	t
fbc24d1f-9ad6-4a3c-b9aa-eda36f4612dc	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	12D	ECONOMY	12	D	{}	t
98e58bab-170c-4d8f-8e39-70fda6bd077f	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	12E	ECONOMY	12	E	{}	t
4f61ac31-2311-4126-84d7-6f214a7d499c	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	12F	ECONOMY	12	F	{}	t
6430e812-56ae-41c7-a8c6-18e9390d5c1e	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	13A	ECONOMY	13	A	{}	f
47b60d81-a933-4a52-8a57-aa77f067d7b0	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	13B	ECONOMY	13	B	{}	f
6fb3df25-c550-49b2-b462-415b8824ce1b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	13C	ECONOMY	13	C	{}	f
b73c6ab6-badb-41dd-b528-92cc8c615ebc	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	13D	ECONOMY	13	D	{}	f
9227fceb-fd3d-47ad-9187-88a9a07b519a	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	13E	ECONOMY	13	E	{}	f
40aeca8b-21c3-4fc4-ac8e-1b08ae656f0d	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	13F	ECONOMY	13	F	{}	f
c600e0d7-773f-4ff5-8e80-3935acfc4f11	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	14A	ECONOMY	14	A	{}	f
942577e2-1e59-434f-8f4a-b46300e37a31	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	14B	ECONOMY	14	B	{}	f
cedab54a-278a-461f-900e-e792621e51ee	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	14C	ECONOMY	14	C	{}	f
a802d997-dee7-432e-bfc9-8a963e849407	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	14D	ECONOMY	14	D	{}	f
c8070952-3e8e-49cf-b14b-fdd2752e62e4	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	14E	ECONOMY	14	E	{}	f
197bbfa0-b6f5-4f8b-b156-38c81d182afd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	14F	ECONOMY	14	F	{}	f
fd204e32-bbc9-48dc-8a3b-c890dd3936d2	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	15A	ECONOMY	15	A	{}	f
dcf4b629-0eac-4c72-8723-adace5e5d4bf	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	15B	ECONOMY	15	B	{}	f
1c58123a-c401-4439-93f3-57c8d0c49ffb	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	15C	ECONOMY	15	C	{}	f
9a33ac9f-0364-4d65-929f-4845a9b85463	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	15D	ECONOMY	15	D	{}	f
1db2b6b0-3ffc-4de5-8d52-237d5ab8a0a3	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	15E	ECONOMY	15	E	{}	f
66094f53-9d31-44d4-ac4e-19d74e8ddd27	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	15F	ECONOMY	15	F	{}	f
4c6c6df4-9fda-44e0-b0a4-4660a732c0dd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	16A	ECONOMY	16	A	{}	f
5778f0e6-18e2-43e0-b514-9b05fd4904f3	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	16B	ECONOMY	16	B	{}	f
4f070ab8-2f1e-4b6e-860c-cb97335b5d1a	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	16C	ECONOMY	16	C	{}	f
5636e01d-3887-431f-8056-497fcbb23284	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	16D	ECONOMY	16	D	{}	f
e7ea6478-d2b0-43d4-a5c9-e794e91d43df	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	16E	ECONOMY	16	E	{}	f
05a7d53a-13bc-44d5-b223-e72ec7e21453	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	16F	ECONOMY	16	F	{}	f
f79c677d-1c10-465c-af28-129791e725f9	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	17A	ECONOMY	17	A	{}	f
f40d5236-a44a-44ce-9251-93298ccd87e3	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	17B	ECONOMY	17	B	{}	f
05051579-4d5b-4b75-bc06-d641d45d5014	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	17C	ECONOMY	17	C	{}	f
06b2ee6f-e7c1-4f52-8baa-4d4487f56994	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	17D	ECONOMY	17	D	{}	f
0bc8214f-3cc7-413e-a09f-94036a230dcd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	17E	ECONOMY	17	E	{}	f
25833af1-6979-4e6c-b2ea-7d4b251d092a	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	17F	ECONOMY	17	F	{}	f
3a6d9cf8-8756-4523-8f74-25c97aff90d3	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	18A	ECONOMY	18	A	{}	f
911e8c31-5a8a-4353-8bb4-5b039181d543	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	18B	ECONOMY	18	B	{}	f
5ba27f28-2f93-46e6-942a-ac945779a12e	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	18C	ECONOMY	18	C	{}	f
3027445d-d6ec-4798-8bde-854923efa6c9	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	18D	ECONOMY	18	D	{}	f
05f3d161-bae1-48d0-ad80-3a5b810f1108	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	18E	ECONOMY	18	E	{}	f
8448bd1b-e0ad-4008-830d-e7f62d3de084	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	18F	ECONOMY	18	F	{}	f
1f58af85-dca4-4b13-bd8b-db8f87d1cb75	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	19A	ECONOMY	19	A	{}	f
1d5f40a8-015a-4805-a644-f7f2bb302b1e	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	19B	ECONOMY	19	B	{}	f
7e6bf2bd-64f9-4bd0-998d-4737b045f50a	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	19C	ECONOMY	19	C	{}	f
2f53027c-dd10-4059-8214-ca4f169d9fa5	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	19D	ECONOMY	19	D	{}	f
c453f432-885e-4525-bff5-0bbbe6757ff7	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	19E	ECONOMY	19	E	{}	f
4696d8de-cada-491f-a8cf-27cf94b4777e	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	19F	ECONOMY	19	F	{}	f
ad46625a-4548-4fb5-b824-fd0eaa9def0f	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	20A	ECONOMY	20	A	{}	f
e62aeb65-dacf-44c0-ac1f-af5dfc37c18b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	20B	ECONOMY	20	B	{}	f
7fb0ac44-d12d-4486-b77f-e1fba2c2642d	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	20C	ECONOMY	20	C	{}	f
6fabfb23-7efa-45f2-ab10-77c99eb82b89	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	20D	ECONOMY	20	D	{}	f
d131617d-dd93-4acd-86cd-3ec4adea8abf	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	20E	ECONOMY	20	E	{}	f
fb943b66-8ee3-4e85-8d41-b44b0ed3dd66	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	20F	ECONOMY	20	F	{}	f
4a26deb5-36dc-4235-aa28-23224ccf3575	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	21A	ECONOMY	21	A	{}	f
51581d3f-7149-4f6d-8a0f-b47b7853f680	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	21B	ECONOMY	21	B	{}	f
d2cbefaa-d0f4-440f-a538-af0d5f7d10fc	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	21C	ECONOMY	21	C	{}	f
6f5b1a0c-fd57-46e7-b6b3-c1cf47b5cf9a	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	21D	ECONOMY	21	D	{}	f
da346979-ed8b-4283-8eaf-20db201e9989	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	21E	ECONOMY	21	E	{}	f
f5335637-6db9-4323-9826-fe42dc5fe175	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	21F	ECONOMY	21	F	{}	f
9a131646-6a02-46a2-8614-3cd41e6ab527	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	22A	ECONOMY	22	A	{}	f
7cdfe6a2-5aa0-41e1-9a19-a1b63e5f063f	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	22B	ECONOMY	22	B	{}	f
a8025106-09ca-4fc8-bfbc-0d0594046155	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	22C	ECONOMY	22	C	{}	f
ba4dcfee-70b6-4228-ba07-0284785a6c0f	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	22D	ECONOMY	22	D	{}	f
bbea089d-8ad4-4046-ba8d-bb88de917cca	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	22E	ECONOMY	22	E	{}	f
6ea201b0-d2fd-425f-96f1-121ab0e4348e	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	22F	ECONOMY	22	F	{}	f
09045bf7-905e-4c16-b58e-c28d20e71e06	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	23A	ECONOMY	23	A	{}	f
5327e8c4-b77e-4990-a5d5-aed23ccfc3d8	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	23B	ECONOMY	23	B	{}	f
04964bba-e375-4cce-9d47-11f4c64324b1	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	23C	ECONOMY	23	C	{}	f
01169309-c65b-4f6d-9726-385c405068f9	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	23D	ECONOMY	23	D	{}	f
32d9b392-5e2a-47f5-a9f9-c36fa4551548	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	23E	ECONOMY	23	E	{}	f
17cdfd73-262b-44fe-8311-79f92a6f7807	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	23F	ECONOMY	23	F	{}	f
ee642d29-0c70-4b9f-8328-cfc7669e0e3f	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	24A	ECONOMY	24	A	{}	f
7d2b2473-c47b-4128-828b-ce64f5ac46ba	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	24B	ECONOMY	24	B	{}	f
4bf5ad70-b34f-4ee5-863e-cfb308ef5c34	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	24C	ECONOMY	24	C	{}	f
cfb3053e-3b50-48d7-b458-c2db88b95102	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	24D	ECONOMY	24	D	{}	f
dcbe93b7-1b7a-4206-9620-e073b2796fd8	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	24E	ECONOMY	24	E	{}	f
c169b237-354e-48ab-b1cc-8e5210ace7b5	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	24F	ECONOMY	24	F	{}	f
81cd0269-af64-47cc-bc72-fd55851ddad0	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	25A	ECONOMY	25	A	{}	t
7d4c55c9-3106-4d6e-a339-5197df3c0895	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	25B	ECONOMY	25	B	{}	t
f4a634c3-0817-453c-b537-12340c655f43	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	25C	ECONOMY	25	C	{}	t
20b1456e-27d7-423d-8f89-3920b303fccf	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	25D	ECONOMY	25	D	{}	t
41607da3-6180-4b37-8272-ba0d157dd52d	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	25E	ECONOMY	25	E	{}	t
f703105f-b710-410f-8c48-2926ca95889b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	25F	ECONOMY	25	F	{}	t
ea1ad3a6-749b-48ce-9694-0464ad9378b1	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	26A	ECONOMY	26	A	{}	f
03de534d-3af3-489c-9af5-2466442443cf	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	26B	ECONOMY	26	B	{}	f
e6e95838-9eff-4ca9-9c87-cee53568e072	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	26C	ECONOMY	26	C	{}	f
86b05fe6-d563-4604-b370-887e65d412c8	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	26D	ECONOMY	26	D	{}	f
8c98526b-cf42-4763-9a70-a9217eae2e36	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	26E	ECONOMY	26	E	{}	f
bf6ac0d0-3cd2-4ffd-a04a-974984ecd9b5	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	26F	ECONOMY	26	F	{}	f
923f9555-0575-4ffa-af5e-3c4a87f688fa	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	27A	ECONOMY	27	A	{}	f
1dfd4e2e-f024-4b97-9f1f-8810f7d4b8ad	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	27B	ECONOMY	27	B	{}	f
8449392f-7708-406a-ab77-abe73ecd50ef	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	27C	ECONOMY	27	C	{}	f
3d4e2065-b4e0-4015-b412-55b00bef4c81	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	27D	ECONOMY	27	D	{}	f
6c249b72-5e93-4da6-89ea-58c0c625d9a6	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	27E	ECONOMY	27	E	{}	f
27c31f23-3cc2-4632-ba7c-5388013570a1	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	27F	ECONOMY	27	F	{}	f
ee8f1092-7572-458e-a3e2-e75c0f689fa1	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	28A	ECONOMY	28	A	{}	f
e2da4c5a-d0a8-4f08-800c-37fad8dbdbe1	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	28B	ECONOMY	28	B	{}	f
a2618f10-f550-4223-9447-1e26285005df	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	28C	ECONOMY	28	C	{}	f
752ee89d-8b0d-44a3-9885-9b2bb6b7a31e	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	28D	ECONOMY	28	D	{}	f
a276b0dc-4a2b-4eac-b217-ded3dba059ab	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	28E	ECONOMY	28	E	{}	f
e8b816b3-21b3-4e15-b8a1-bd1b0537614a	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	28F	ECONOMY	28	F	{}	f
5a845778-0234-4da2-b6cd-6ac9fbc2c369	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	29A	ECONOMY	29	A	{}	f
0b3bfdfb-361b-4038-9393-8e644207c449	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	29B	ECONOMY	29	B	{}	f
3d4f0693-85ae-43d3-b9ec-ca0e32f416fd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	29C	ECONOMY	29	C	{}	f
acd9d860-4028-47b4-8781-304c7b0f8013	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	29D	ECONOMY	29	D	{}	f
f947a703-2345-4ccd-a9db-25bdb5643534	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	29E	ECONOMY	29	E	{}	f
f25571c3-abfc-40ab-a49d-80758e3faa79	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	29F	ECONOMY	29	F	{}	f
0070e70a-c7f5-4124-a101-4e85f07e99c3	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	30A	ECONOMY	30	A	{}	f
32c62a80-6e68-4d53-ba1c-1a266e1c38bb	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	30B	ECONOMY	30	B	{}	f
dd8aaa37-c6ed-4de4-aea4-46b40c22764c	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	30C	ECONOMY	30	C	{}	f
69e11a03-ee0d-440c-af4d-8f8b80b8c720	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	30D	ECONOMY	30	D	{}	f
3acc90d1-c69f-4e25-b887-797419ca05f1	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	30E	ECONOMY	30	E	{}	f
9b350461-b69d-4280-bca2-db1eb863290b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	30F	ECONOMY	30	F	{}	f
91882cea-555c-498f-a165-de67c14f929d	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	31A	ECONOMY	31	A	{}	f
492ed506-7513-4acf-9c93-ce5108f0c1f1	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	31B	ECONOMY	31	B	{}	f
8c8db0ec-3a91-4cc4-8139-bef08a45b02f	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	31C	ECONOMY	31	C	{}	f
5668bfe3-485c-4fcf-9402-6d8854a72ad1	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	31D	ECONOMY	31	D	{}	f
03110d17-e926-4865-a381-4973e086734a	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	31E	ECONOMY	31	E	{}	f
aa9ba098-8d16-4fbd-a6f4-ad012719b384	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	31F	ECONOMY	31	F	{}	f
dc9276a9-c92b-4b7a-8a56-96a56af46722	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	32A	ECONOMY	32	A	{}	f
8fe1d2c3-ab0d-4d58-9214-57abfb13fb79	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	32B	ECONOMY	32	B	{}	f
7c374e7b-307b-4ca4-a6f3-e1f79bf8d43b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	32C	ECONOMY	32	C	{}	f
db8a18c2-1a31-4af6-8f6b-8de5d0869270	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	32D	ECONOMY	32	D	{}	f
a7b98a06-ac06-4e9c-b73b-863602c2a218	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	32E	ECONOMY	32	E	{}	f
107cae2b-d955-4380-84ae-866e4be4c871	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	32F	ECONOMY	32	F	{}	f
5e295486-662f-4903-8bf8-e5fe3256020d	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	33A	ECONOMY	33	A	{}	f
8ad2de06-8538-44bb-91a6-2e074a71a688	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	33B	ECONOMY	33	B	{}	f
cfeb9c97-a7a6-4492-9703-fb2b75da7bef	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	33C	ECONOMY	33	C	{}	f
a74e9eb5-40a8-428b-9fdc-e3176bdc41ce	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	33D	ECONOMY	33	D	{}	f
74ddde3a-495b-4a27-a95c-e0507745e5da	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	33E	ECONOMY	33	E	{}	f
c6c39336-ce59-408c-a8b9-516a3dffa488	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	33F	ECONOMY	33	F	{}	f
d18bf2cf-2692-4174-b38c-195b1fefab46	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	34A	ECONOMY	34	A	{}	f
35a732c6-bd69-41d7-ba53-69587bbc350c	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	34B	ECONOMY	34	B	{}	f
b1650c6e-98cc-46d1-9fdd-f7c0589e109f	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	34C	ECONOMY	34	C	{}	f
4923e6d7-7a6e-4f55-8645-5fdd5ff63bf4	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	34D	ECONOMY	34	D	{}	f
4b206719-53f9-47a6-b641-a926dcb39295	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	34E	ECONOMY	34	E	{}	f
8587cad3-ab08-47bf-b478-0fd64243e85f	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	34F	ECONOMY	34	F	{}	f
0a5b8d89-5d24-42d9-9f75-c4b5b53edf69	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	35A	ECONOMY	35	A	{}	f
e19ba57c-e705-40ec-ad31-95463037d7b9	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	35B	ECONOMY	35	B	{}	f
266f5d7d-0ca4-437e-8d47-5dfecec94957	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	35C	ECONOMY	35	C	{}	f
81209f96-23af-4140-8d54-a20eddcc571d	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	35D	ECONOMY	35	D	{}	f
9bdf0e71-a374-4ce0-a449-65210f560fd7	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	35E	ECONOMY	35	E	{}	f
c4f42d0f-7674-4559-a703-0a67329a817d	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	35F	ECONOMY	35	F	{}	f
5e8cdfb8-12e4-40f7-ab44-12be7ed40209	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	36A	ECONOMY	36	A	{}	f
6f9be772-91bf-47de-ad70-3ee9dccab102	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	36B	ECONOMY	36	B	{}	f
dcb9fb0c-8288-407d-8804-68bac0187666	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	36C	ECONOMY	36	C	{}	f
55feac27-da79-4786-b834-ba447b200d1a	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	36D	ECONOMY	36	D	{}	f
dd9fff39-2ab1-42d5-8475-364429a6561c	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	36E	ECONOMY	36	E	{}	f
4cf18b10-237f-46e2-a49a-c3131594c289	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	36F	ECONOMY	36	F	{}	f
a820b183-3048-4111-83d7-384820960d53	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	37A	ECONOMY	37	A	{}	f
a71ab11c-9772-4a19-91df-7cbcadb652f5	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	37B	ECONOMY	37	B	{}	f
61e834b1-579e-4967-bfd3-d74d8cafffb4	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	37C	ECONOMY	37	C	{}	f
945a76c3-6613-41cd-9daa-ff6fc69a506c	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	37D	ECONOMY	37	D	{}	f
b94e3163-3807-4fe2-8be6-6fdd72e128ba	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	37E	ECONOMY	37	E	{}	f
91ee5f2c-bb31-4631-a86e-6563f3b053b3	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	37F	ECONOMY	37	F	{}	f
3d42050e-aba3-4c99-b763-9a33fc97ccdf	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	38A	ECONOMY	38	A	{}	f
86c6bc1c-6388-49bb-8495-5970fa6ea37d	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	38B	ECONOMY	38	B	{}	f
53d001ae-9a1a-4913-b381-059465bd429b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	38C	ECONOMY	38	C	{}	f
8538746b-3d23-4534-8ea5-3b3777b7372c	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	38D	ECONOMY	38	D	{}	f
61c82ebf-9d3b-4ad7-ae49-2e33975fe7f5	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	38E	ECONOMY	38	E	{}	f
0f047d6c-99ab-405c-b1c1-4a2f9281f7a4	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	38F	ECONOMY	38	F	{}	f
ea3daf0c-6826-4d43-9856-83350b5dbcd4	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	39A	ECONOMY	39	A	{}	f
07f8e566-cb4f-4d42-838a-d3f592870aa8	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	39B	ECONOMY	39	B	{}	f
a3f1efe8-2009-4033-b6c0-b305ba0b3712	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	39C	ECONOMY	39	C	{}	f
acddaea2-03e7-4e3c-98bb-f3bc4536062a	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	39D	ECONOMY	39	D	{}	f
07eac0a5-13ed-4374-afa9-578f4096369a	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	39E	ECONOMY	39	E	{}	f
babd54df-117b-45e6-b1fe-6aef18866541	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	39F	ECONOMY	39	F	{}	f
33b24216-f128-4f2d-aac8-0470c98688d3	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	40A	ECONOMY	40	A	{}	f
bd1209b8-170f-45ff-930e-6cd0b86ce2ab	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	40B	ECONOMY	40	B	{}	f
bd5a0a70-90b9-4e16-a632-04942409e146	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	40C	ECONOMY	40	C	{}	f
5cb26936-db05-4fc2-8666-4d1205661ec2	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	40D	ECONOMY	40	D	{}	f
dcf5c99e-97a0-4cc9-b06d-1fdfbbf85447	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	40E	ECONOMY	40	E	{}	f
5cd0fa31-d234-468f-ad4e-da72889bc4e0	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	40F	ECONOMY	40	F	{}	f
7be59cc8-9cd3-43dc-b89f-0c69110a59a3	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	41A	ECONOMY	41	A	{}	f
0dc29f76-b23f-4c35-8401-618beac855a5	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	41B	ECONOMY	41	B	{}	f
9f4194f4-330a-413e-9d3f-bbd13a09a46b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	41C	ECONOMY	41	C	{}	f
7ad8723c-c88b-4a90-9edc-8263798daf9e	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	41D	ECONOMY	41	D	{}	f
21361a25-a58c-4555-bf43-183c669c22b4	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	41E	ECONOMY	41	E	{}	f
32b51a58-5f96-4ba2-b1ad-d3041ead204b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	41F	ECONOMY	41	F	{}	f
9413d857-b8c7-4409-babd-c4e144df0a2b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	42A	ECONOMY	42	A	{}	f
5d974d50-53e5-46ce-94a4-805322dad2e1	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	42B	ECONOMY	42	B	{}	f
aee533b6-e512-4667-922a-f08a8f6a5aab	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	42C	ECONOMY	42	C	{}	f
26afe5e8-6e22-4f82-af9a-912d67a56c48	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	42D	ECONOMY	42	D	{}	f
3fef794b-197d-4e59-9ca7-27cc55256f32	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	42E	ECONOMY	42	E	{}	f
39398134-ca9c-4240-985b-13f803ea3f2f	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	42F	ECONOMY	42	F	{}	f
ccfb5bd7-6cef-47fa-bb4b-d858fd00a6de	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	43A	ECONOMY	43	A	{}	f
e2b24162-9dab-4db6-88e7-431d3985ad7c	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	43B	ECONOMY	43	B	{}	f
56332dab-0436-4568-8795-f9d488d4e3be	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	43C	ECONOMY	43	C	{}	f
55e1c5da-37c8-43ba-a4d8-57fa3f0730fd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	43D	ECONOMY	43	D	{}	f
a2038baa-df23-469f-aeb6-b4f7ee24c5a9	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	43E	ECONOMY	43	E	{}	f
f7fc6717-097f-42db-9e4b-2eef93e4d0ec	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	43F	ECONOMY	43	F	{}	f
6a166d9e-163f-4229-afed-0ce607dd1d29	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	44A	ECONOMY	44	A	{}	f
3dfafd8e-da36-4fe9-8e8a-1e4688dce509	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	44B	ECONOMY	44	B	{}	f
4c5127b2-7e63-467c-ac84-725a51dfb3b2	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	44C	ECONOMY	44	C	{}	f
55e10a5e-f2f5-4a70-ad39-23b197bf46ff	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	44D	ECONOMY	44	D	{}	f
0fa41a5e-e057-4a98-8dc9-3eeb137f640c	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	44E	ECONOMY	44	E	{}	f
9aba44b2-7344-42ca-944b-63fa684e6850	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	44F	ECONOMY	44	F	{}	f
15141961-7acb-4ec2-ab01-6d99006e6d35	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	45A	ECONOMY	45	A	{}	f
6219edb9-9233-40f4-843d-7c02d36170d3	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	45B	ECONOMY	45	B	{}	f
03feef01-cc87-4039-96eb-61cd98a2fcfa	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	45C	ECONOMY	45	C	{}	f
e5668ee1-c5fa-4cbf-8f00-dee91558507a	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	45D	ECONOMY	45	D	{}	f
11880969-9617-41b4-b809-211cf55b40da	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	45E	ECONOMY	45	E	{}	f
32a4d2bd-978e-48ab-a286-e1f6d509c5b7	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	45F	ECONOMY	45	F	{}	f
b57b6991-5375-4d98-8b54-0e92e74aa665	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	46A	ECONOMY	46	A	{}	f
8fc2a190-a5a7-4e2d-b564-68f41899279a	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	46B	ECONOMY	46	B	{}	f
c39946a0-461a-4a7f-a2e2-156488b7c258	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	46C	ECONOMY	46	C	{}	f
95e1a0dd-c82c-46ea-9e14-f216168c69b9	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	46D	ECONOMY	46	D	{}	f
3dc2f851-8bc5-4ba0-a5e0-67954e520580	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	46E	ECONOMY	46	E	{}	f
00da8fd3-e12b-414b-9575-da114b75b24a	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	46F	ECONOMY	46	F	{}	f
035c9ee9-2e49-4965-b8c6-e55979f740e0	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	47A	ECONOMY	47	A	{}	f
5018b618-ff30-49e2-ae56-55b7db5b820f	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	47B	ECONOMY	47	B	{}	f
a5c13a4a-736b-41c2-8982-d2731afb5137	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	47C	ECONOMY	47	C	{}	f
e9045e70-3528-4a7f-b6e3-8e69ded1cfc4	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	47D	ECONOMY	47	D	{}	f
fce8f186-3d59-438b-81cb-5d9fa9c26b50	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	47E	ECONOMY	47	E	{}	f
3c906b32-695c-43b0-996e-2dca1fc6bf76	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	47F	ECONOMY	47	F	{}	f
02ae61b7-a321-4ba2-8f02-932bc1b5210e	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	48A	ECONOMY	48	A	{}	f
33ddaf07-8ce3-4b4f-93ee-a732bed04b0e	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	48B	ECONOMY	48	B	{}	f
6127bb11-3912-45e1-bfd1-39cd48432255	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	48C	ECONOMY	48	C	{}	f
183b5ef9-f97b-4dd5-a027-b2a23ed32489	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	48D	ECONOMY	48	D	{}	f
94b464c5-0646-4506-8893-54fff7b3e5fe	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	48E	ECONOMY	48	E	{}	f
56e776ba-fe95-4420-b02e-30c5dc5b5d0c	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	48F	ECONOMY	48	F	{}	f
d84bd503-7ba5-443b-bc8c-bd26a161d2f9	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	49A	ECONOMY	49	A	{}	f
f99320b4-90b5-45dc-a05d-d3210685df2c	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	49B	ECONOMY	49	B	{}	f
3e8d8a8b-d635-47b9-b52a-0849a69833f7	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	49C	ECONOMY	49	C	{}	f
54fa056f-eb19-4e64-824b-7f5e53e94582	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	49D	ECONOMY	49	D	{}	f
032c17b4-165a-4b38-8a76-d7361068c8e1	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	49E	ECONOMY	49	E	{}	f
cca3096b-eb74-4e13-8665-ea629f5843fc	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	49F	ECONOMY	49	F	{}	f
5ea097d9-c94e-484c-9cb4-21bf29a18b6f	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	50A	ECONOMY	50	A	{}	f
ba2b43a7-a99c-4ab9-aa7e-50e8911eadcb	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	50B	ECONOMY	50	B	{}	f
d072d39a-8495-40b8-a1fe-de26324e13be	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	50C	ECONOMY	50	C	{}	f
9babea76-cd32-485d-ab95-4a56be8aba98	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	50D	ECONOMY	50	D	{}	f
329dcd59-5917-4917-8ea2-5a95fe796a3f	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	50E	ECONOMY	50	E	{}	f
f5f01f89-2849-4ce7-b369-680c70abe600	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	50F	ECONOMY	50	F	{}	f
15f85427-c7f2-4b55-9f92-718197f2b711	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	51A	ECONOMY	51	A	{}	f
ada455b8-ce0c-42de-a39e-0a3128283de4	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	51B	ECONOMY	51	B	{}	f
d9a54b4d-e42a-4633-96f4-84843ad43341	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	51C	ECONOMY	51	C	{}	f
912bfd1d-1009-4489-ba25-55e9367a784e	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	51D	ECONOMY	51	D	{}	f
4cc5c4f6-4589-42de-bd3b-a8550f06a2b3	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	51E	ECONOMY	51	E	{}	f
c605d889-8490-490e-b7a9-cd559c10cb48	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	51F	ECONOMY	51	F	{}	f
f5391c13-20aa-4789-8cd7-a427b80a24a9	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	52A	ECONOMY	52	A	{}	f
a6ec7e68-371e-4575-a375-09129846130c	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	52B	ECONOMY	52	B	{}	f
dddf1c7b-203b-406b-9921-84db753ffec2	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	52C	ECONOMY	52	C	{}	f
c8a42284-48b3-4b5c-9dd0-c4af643ca40a	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	52D	ECONOMY	52	D	{}	f
dabfbad1-2a57-4d9c-902f-9bc1e40c0cea	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	52E	ECONOMY	52	E	{}	f
8286f7b2-f181-471b-988a-108733c35e16	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	52F	ECONOMY	52	F	{}	f
9cf2a335-cb0b-4a99-b14b-6eb1f8b3a86f	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	53A	ECONOMY	53	A	{}	f
c02670b6-c35d-4a4e-bdb9-3b8491df5a1c	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	53B	ECONOMY	53	B	{}	f
e5157461-07f2-4c61-bce4-bd9d41310f2d	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	53C	ECONOMY	53	C	{}	f
7b82b925-438a-4a06-ad02-2d3a90a54aac	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	53D	ECONOMY	53	D	{}	f
f5518644-3e1f-4355-81a6-6cb4a4ecf64d	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	53E	ECONOMY	53	E	{}	f
17f1bf80-c2c4-4329-8615-ac77add02183	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	53F	ECONOMY	53	F	{}	f
d9eb5342-d6e0-4f16-9fc0-aa6dbcb7c060	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	54A	ECONOMY	54	A	{}	f
ef41ea79-b8f5-40c3-add3-15b0ea39dee2	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	54B	ECONOMY	54	B	{}	f
65c9e94c-67d6-41d6-8cd4-9f08c4181a8a	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	54C	ECONOMY	54	C	{}	f
97451933-d049-4e1d-b46c-83c6371076ea	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	54D	ECONOMY	54	D	{}	f
88c21383-906f-48d0-b307-8a46e03a3828	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	54E	ECONOMY	54	E	{}	f
27be71e6-3f54-4985-9839-3f3c1e191725	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	54F	ECONOMY	54	F	{}	f
88c1b6fe-e54d-4096-83a5-a2b030ba6f2c	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	55A	ECONOMY	55	A	{}	f
bd84184b-81e5-4888-814f-6dc6ea77f9b9	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	55B	ECONOMY	55	B	{}	f
a6457a03-1ece-4a1d-9a58-e40659509d6d	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	55C	ECONOMY	55	C	{}	f
f241d83a-615c-4c23-b71f-4ba84fa6c8b1	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	55D	ECONOMY	55	D	{}	f
b06c9735-708e-4a6d-9e52-1314e623e5a2	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	55E	ECONOMY	55	E	{}	f
54bf4be8-ed78-4a0f-a10f-ddc9010e090e	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	55F	ECONOMY	55	F	{}	f
2a36e0ad-bbc0-4c92-8146-3616dbf7b1cb	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	56A	ECONOMY	56	A	{}	f
2942ab28-9670-4b36-8c5e-3b3ad74c83b4	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	56B	ECONOMY	56	B	{}	f
d1dd31f8-ec50-4dec-baa8-14174bc08400	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	56C	ECONOMY	56	C	{}	f
1a5634b0-4cfa-4031-b878-3de37a8327d7	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	56D	ECONOMY	56	D	{}	f
74e0cfb5-e255-427d-8abb-1ea3505c14ff	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	56E	ECONOMY	56	E	{}	f
cca72738-1c37-44f4-a00b-62771c0a4a9a	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	56F	ECONOMY	56	F	{}	f
8c4e5e0f-2e6b-4a68-af4c-c4950262a6c1	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	57A	ECONOMY	57	A	{}	f
905e0c15-df7d-47b8-8fea-62669bd479e7	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	57B	ECONOMY	57	B	{}	f
1a3b960b-a6d0-417d-b2ec-fd979c971c1c	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	57C	ECONOMY	57	C	{}	f
4ce9398d-5f88-4b7f-a7f0-b438a44b09bd	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	57D	ECONOMY	57	D	{}	f
6514be8f-1aa2-42ff-bd48-f888079d2a95	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	57E	ECONOMY	57	E	{}	f
7dc20b5c-e5fc-4460-b44e-5c3462b24b77	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	57F	ECONOMY	57	F	{}	f
12554a68-21d6-48e3-ba7d-93a6d758d8d0	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	58A	ECONOMY	58	A	{}	f
b92463c7-1ee1-41a3-b709-5aab8e979c50	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	58B	ECONOMY	58	B	{}	f
e2c76a70-671b-4b51-af63-351ef2da324b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	58C	ECONOMY	58	C	{}	f
cb2d4a49-0283-4ffd-b693-bad8e5b6970f	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	58D	ECONOMY	58	D	{}	f
c4cd07a5-cfc4-446a-a3c4-ab42d88fc615	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	58E	ECONOMY	58	E	{}	f
51822362-0d8b-4f62-869a-b83918c9c658	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	58F	ECONOMY	58	F	{}	f
a4f96a4c-2971-479d-8477-c7aaf70aa38d	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	59A	ECONOMY	59	A	{}	f
82d5eab6-d4c1-4cd4-b660-09010cad3475	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	59B	ECONOMY	59	B	{}	f
d9aa3604-847c-4d03-a461-d83975b6262a	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	59C	ECONOMY	59	C	{}	f
f8b0b2f6-0d52-4f9b-b920-0cbd7139dd83	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	59D	ECONOMY	59	D	{}	f
2ac547de-11fb-4130-9be1-848e529e29b2	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	59E	ECONOMY	59	E	{}	f
b38c6b79-e57b-4abe-b3a4-0d49496c8b2d	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	59F	ECONOMY	59	F	{}	f
d4e6000f-f2f3-452d-a504-994b86f78056	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	60A	ECONOMY	60	A	{}	f
1bca53a4-bc50-4e1c-b968-2f8f1b81faa1	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	60B	ECONOMY	60	B	{}	f
5885a07b-2c3b-4cb8-a819-edcb1b128d4b	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	60C	ECONOMY	60	C	{}	f
7b40f752-f8bf-4be8-8d32-ce309c34aef8	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	60D	ECONOMY	60	D	{}	f
1b095fb7-dd0f-4f26-bb60-14211341a509	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	60E	ECONOMY	60	E	{}	f
972b6cb8-9bc4-438c-b2bb-80dd431151f1	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	60F	ECONOMY	60	F	{}	f
ea64ab81-fc89-4cfb-a35d-e47aa4342ec4	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	61A	ECONOMY	61	A	{}	f
cc7a61b3-4dd8-4d31-87ad-2f13ff386da4	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	61B	ECONOMY	61	B	{}	f
2dfc449b-9170-4a58-a721-e5bdd8aee0cb	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	61C	ECONOMY	61	C	{}	f
ec1c5bef-3c71-46e4-a652-2b0d953e172f	b2eabc60-d8ac-4f4e-bdfd-b6b754b8da82	61D	ECONOMY	61	D	{}	f
63455012-09da-4c62-8fee-c83c16379ef2	a5c588e1-b27d-4401-a431-f3d9a95e3bac	1A	FIRST	1	A	{}	f
71b03944-8bff-4b3c-bc53-f40229510bfc	a5c588e1-b27d-4401-a431-f3d9a95e3bac	1B	FIRST	1	B	{}	f
2617c5c5-5fa9-41cc-a81c-2c617e5f9994	a5c588e1-b27d-4401-a431-f3d9a95e3bac	1C	FIRST	1	C	{}	f
9a1058c6-d906-4b52-8d13-71898b791411	a5c588e1-b27d-4401-a431-f3d9a95e3bac	1D	FIRST	1	D	{}	f
5a6020a4-2cf5-4e4e-bc58-f0538d427669	a5c588e1-b27d-4401-a431-f3d9a95e3bac	1E	FIRST	1	E	{}	f
bba3e54c-4ed5-4644-bacd-f8907cd66160	a5c588e1-b27d-4401-a431-f3d9a95e3bac	1F	FIRST	1	F	{}	f
597e10f5-4a14-4203-8932-6363db866c2c	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2A	FIRST	2	A	{}	f
70ea884f-90fd-400e-8ea4-9e1513c96d1b	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2B	FIRST	2	B	{}	f
55935f61-61a9-41a9-ad00-bd2cdb3e6555	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2C	FIRST	2	C	{}	f
04a8ba34-930c-4142-92f6-db61eba1eadf	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2D	FIRST	2	D	{}	f
8fe9e844-cdc9-416b-b10c-74519ca2bf5f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2E	FIRST	2	E	{}	f
0f4aaca0-6796-404e-859e-bff4c8ddc868	a5c588e1-b27d-4401-a431-f3d9a95e3bac	2F	FIRST	2	F	{}	f
2370968b-0b91-42fd-8ace-52fbad360bc6	a5c588e1-b27d-4401-a431-f3d9a95e3bac	3A	BUSINESS	3	A	{}	f
dcac6ff8-f5fd-4522-a634-c88e1118b4f8	a5c588e1-b27d-4401-a431-f3d9a95e3bac	3B	BUSINESS	3	B	{}	f
88f437f9-3966-4d70-9a7a-82863404c77b	a5c588e1-b27d-4401-a431-f3d9a95e3bac	3C	BUSINESS	3	C	{}	f
78cd5be8-c278-4035-b5f7-fa331fb1a4dc	a5c588e1-b27d-4401-a431-f3d9a95e3bac	3D	BUSINESS	3	D	{}	f
7fb5eb4a-5939-41d9-bd06-8cdfc18b1db8	a5c588e1-b27d-4401-a431-f3d9a95e3bac	3E	BUSINESS	3	E	{}	f
bfbcbee9-0778-41fb-960a-81a33133a7bf	a5c588e1-b27d-4401-a431-f3d9a95e3bac	3F	BUSINESS	3	F	{}	f
f26844e7-0f21-4b2b-9d0c-2aa55066c4a2	a5c588e1-b27d-4401-a431-f3d9a95e3bac	4A	BUSINESS	4	A	{}	f
929f23d9-19bf-442a-9af8-6daf0cd56941	a5c588e1-b27d-4401-a431-f3d9a95e3bac	4B	BUSINESS	4	B	{}	f
1c0bc367-987f-412c-85cd-33a732841a29	a5c588e1-b27d-4401-a431-f3d9a95e3bac	4C	BUSINESS	4	C	{}	f
f945a04b-d7ca-4a89-bcd6-f48b8c967624	a5c588e1-b27d-4401-a431-f3d9a95e3bac	4D	BUSINESS	4	D	{}	f
7bfe4dbf-38b0-4ade-944b-e68029e11896	a5c588e1-b27d-4401-a431-f3d9a95e3bac	4E	BUSINESS	4	E	{}	f
a7a90566-fa73-4c29-83d2-6f4a89c91d46	a5c588e1-b27d-4401-a431-f3d9a95e3bac	4F	BUSINESS	4	F	{}	f
d8f28a83-cd3e-4e09-9dde-a904ce6c1907	a5c588e1-b27d-4401-a431-f3d9a95e3bac	5A	BUSINESS	5	A	{}	f
95e3f33e-fad2-4462-b700-0afa1634b578	a5c588e1-b27d-4401-a431-f3d9a95e3bac	5B	BUSINESS	5	B	{}	f
940437df-5d96-4d7a-b3bf-fd4290aedba4	a5c588e1-b27d-4401-a431-f3d9a95e3bac	5C	BUSINESS	5	C	{}	f
453ab9da-30d3-4a78-ab63-1a3090e6f2fe	a5c588e1-b27d-4401-a431-f3d9a95e3bac	5D	BUSINESS	5	D	{}	f
cc0cc4ee-ac6c-4945-8bc1-d544bb058b07	a5c588e1-b27d-4401-a431-f3d9a95e3bac	5E	BUSINESS	5	E	{}	f
ee906995-7bce-4828-aa82-b06fdbf10c71	a5c588e1-b27d-4401-a431-f3d9a95e3bac	5F	BUSINESS	5	F	{}	f
d5d60657-bb95-4df5-8174-2772d30de45f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	6A	BUSINESS	6	A	{}	f
f5ad9303-44ef-4dde-a7b0-2ff15311b7cf	a5c588e1-b27d-4401-a431-f3d9a95e3bac	6B	BUSINESS	6	B	{}	f
33b17321-15e8-4574-9959-288050897ccc	a5c588e1-b27d-4401-a431-f3d9a95e3bac	6C	BUSINESS	6	C	{}	f
91c51ca3-4f93-4245-9532-8afc032ef405	a5c588e1-b27d-4401-a431-f3d9a95e3bac	6D	BUSINESS	6	D	{}	f
81f0b4fa-b2e5-486e-ae34-def4b5fa3e66	a5c588e1-b27d-4401-a431-f3d9a95e3bac	6E	BUSINESS	6	E	{}	f
e58e88cf-cf42-4ef0-8e6d-0db8572560f3	a5c588e1-b27d-4401-a431-f3d9a95e3bac	6F	BUSINESS	6	F	{}	f
3130b36e-3e19-4c57-8aaf-bb4d61cb08ce	a5c588e1-b27d-4401-a431-f3d9a95e3bac	7A	ECONOMY	7	A	{}	f
bfa7f729-bd7d-45ae-a818-6f34198fe8da	a5c588e1-b27d-4401-a431-f3d9a95e3bac	7B	ECONOMY	7	B	{}	f
f84a1ecd-7cdc-4db7-8378-94b821f1941f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	7C	ECONOMY	7	C	{}	f
9c38e892-63bb-43cd-a471-a98c581c0b75	a5c588e1-b27d-4401-a431-f3d9a95e3bac	7D	ECONOMY	7	D	{}	f
90c1b417-0aa1-40a3-b938-dd21a13348a7	a5c588e1-b27d-4401-a431-f3d9a95e3bac	7E	ECONOMY	7	E	{}	f
f1baa51c-495d-4095-babe-9fda70f3d665	a5c588e1-b27d-4401-a431-f3d9a95e3bac	7F	ECONOMY	7	F	{}	f
11ba878d-b51b-4759-998e-8377895386a3	a5c588e1-b27d-4401-a431-f3d9a95e3bac	8A	ECONOMY	8	A	{}	f
a442ef03-9e2b-4e14-95f2-7b88935eb459	a5c588e1-b27d-4401-a431-f3d9a95e3bac	8B	ECONOMY	8	B	{}	f
6b194143-f5a8-41d9-8e2f-6e317f6aac6a	a5c588e1-b27d-4401-a431-f3d9a95e3bac	8C	ECONOMY	8	C	{}	f
08659ce6-16bf-4ab6-a8c1-ea1313ffa901	a5c588e1-b27d-4401-a431-f3d9a95e3bac	8D	ECONOMY	8	D	{}	f
6a7f337d-3e8e-4fd9-a9b7-84396dbf913a	a5c588e1-b27d-4401-a431-f3d9a95e3bac	8E	ECONOMY	8	E	{}	f
f2a57700-220d-4f39-9db2-924bcdb365b1	a5c588e1-b27d-4401-a431-f3d9a95e3bac	8F	ECONOMY	8	F	{}	f
502fd96f-2a53-4d0d-8913-767911da5dcc	a5c588e1-b27d-4401-a431-f3d9a95e3bac	9A	ECONOMY	9	A	{}	f
62529f8c-c69f-4984-a002-04882c6fd2de	a5c588e1-b27d-4401-a431-f3d9a95e3bac	9B	ECONOMY	9	B	{}	f
c0822e34-4a6f-453c-9318-d651b5849e2c	a5c588e1-b27d-4401-a431-f3d9a95e3bac	9C	ECONOMY	9	C	{}	f
eb7e73c3-7fb9-47fa-a606-172fffdc2dcd	a5c588e1-b27d-4401-a431-f3d9a95e3bac	9D	ECONOMY	9	D	{}	f
72077c48-41f7-4dde-8362-f1b9a1c33b92	a5c588e1-b27d-4401-a431-f3d9a95e3bac	9E	ECONOMY	9	E	{}	f
05244a91-240d-4a91-b8a9-6e6a36e4c928	a5c588e1-b27d-4401-a431-f3d9a95e3bac	9F	ECONOMY	9	F	{}	f
211f064e-7c9c-4bbe-80ae-cd95d731a64d	a5c588e1-b27d-4401-a431-f3d9a95e3bac	10A	ECONOMY	10	A	{}	f
71ff0885-1f37-4094-a613-cfd37df571bd	a5c588e1-b27d-4401-a431-f3d9a95e3bac	10B	ECONOMY	10	B	{}	f
8fde04de-ea75-46e5-8352-f05517acec7e	a5c588e1-b27d-4401-a431-f3d9a95e3bac	10C	ECONOMY	10	C	{}	f
44b53c2e-449e-459d-a91f-e217fda3c645	a5c588e1-b27d-4401-a431-f3d9a95e3bac	10D	ECONOMY	10	D	{}	f
3326e7da-3ec0-41f9-b133-aa9294b3bc39	a5c588e1-b27d-4401-a431-f3d9a95e3bac	10E	ECONOMY	10	E	{}	f
0919e5ab-1428-45d7-aaec-684f1fb3c76d	a5c588e1-b27d-4401-a431-f3d9a95e3bac	10F	ECONOMY	10	F	{}	f
972b4029-4188-43b4-901f-a1b05185e521	a5c588e1-b27d-4401-a431-f3d9a95e3bac	11A	ECONOMY	11	A	{}	f
b38cdffe-15f1-475c-9517-65c4f74070db	a5c588e1-b27d-4401-a431-f3d9a95e3bac	11B	ECONOMY	11	B	{}	f
e202d507-3d51-482e-a94c-6d42b7550a2f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	11C	ECONOMY	11	C	{}	f
f7d85d1d-83e9-4bbd-a361-a1422f484018	a5c588e1-b27d-4401-a431-f3d9a95e3bac	11D	ECONOMY	11	D	{}	f
49d125fa-3bbb-453b-9113-1a77ab4112b2	a5c588e1-b27d-4401-a431-f3d9a95e3bac	11E	ECONOMY	11	E	{}	f
d2d258ff-ef06-47f6-aeea-ebcbbf4f8499	a5c588e1-b27d-4401-a431-f3d9a95e3bac	11F	ECONOMY	11	F	{}	f
228bebea-009e-4509-9a25-4460dc1f7c04	a5c588e1-b27d-4401-a431-f3d9a95e3bac	12A	ECONOMY	12	A	{}	t
a48f751c-4426-4693-8737-677464e22794	a5c588e1-b27d-4401-a431-f3d9a95e3bac	12B	ECONOMY	12	B	{}	t
bd2c4804-ec19-4a8e-a4c1-5f2bbb46965b	a5c588e1-b27d-4401-a431-f3d9a95e3bac	12C	ECONOMY	12	C	{}	t
bf015335-02c3-4f7b-a5f6-6a2ad5defa78	a5c588e1-b27d-4401-a431-f3d9a95e3bac	12D	ECONOMY	12	D	{}	t
ee0e4e1c-bdb1-491f-b312-a27e24dac820	a5c588e1-b27d-4401-a431-f3d9a95e3bac	12E	ECONOMY	12	E	{}	t
0b848075-1265-4457-b0e1-b29ece6ea7dc	a5c588e1-b27d-4401-a431-f3d9a95e3bac	12F	ECONOMY	12	F	{}	t
c8282720-39cf-45ce-beb6-ebd29221182e	a5c588e1-b27d-4401-a431-f3d9a95e3bac	13A	ECONOMY	13	A	{}	f
7eb2cd15-e261-409a-a9ad-20e1edff218c	a5c588e1-b27d-4401-a431-f3d9a95e3bac	13B	ECONOMY	13	B	{}	f
24eb1d7d-47ab-4b20-83c7-6683eb99c6c9	a5c588e1-b27d-4401-a431-f3d9a95e3bac	13C	ECONOMY	13	C	{}	f
ed628874-b78f-40f6-9018-f083b83512fd	a5c588e1-b27d-4401-a431-f3d9a95e3bac	13D	ECONOMY	13	D	{}	f
6a993d3a-52de-4897-aa96-e60fb8c6b4bc	a5c588e1-b27d-4401-a431-f3d9a95e3bac	13E	ECONOMY	13	E	{}	f
03d65cf2-34a6-4e4d-9cef-4577871d6fca	a5c588e1-b27d-4401-a431-f3d9a95e3bac	13F	ECONOMY	13	F	{}	f
f30fa23e-838d-4962-b8dd-9ea2b75e86eb	a5c588e1-b27d-4401-a431-f3d9a95e3bac	14A	ECONOMY	14	A	{}	f
73619cf9-1dfa-4254-a61a-f33df29506e9	a5c588e1-b27d-4401-a431-f3d9a95e3bac	14B	ECONOMY	14	B	{}	f
fa866630-9579-40e3-8237-cf94fc0dbb63	a5c588e1-b27d-4401-a431-f3d9a95e3bac	14C	ECONOMY	14	C	{}	f
bcf5308e-6b64-43b0-a400-c31f9437bcb4	a5c588e1-b27d-4401-a431-f3d9a95e3bac	14D	ECONOMY	14	D	{}	f
d02419a3-f20b-4b33-85f9-c09bb1d7ccbe	a5c588e1-b27d-4401-a431-f3d9a95e3bac	14E	ECONOMY	14	E	{}	f
b357578c-c55b-428e-b5bf-c0077952e2f9	a5c588e1-b27d-4401-a431-f3d9a95e3bac	14F	ECONOMY	14	F	{}	f
fb4eeb4e-76e0-4cac-a97e-ce0a242dcc32	a5c588e1-b27d-4401-a431-f3d9a95e3bac	15A	ECONOMY	15	A	{}	f
1b74763f-f63b-4928-a451-57efe592ad1b	a5c588e1-b27d-4401-a431-f3d9a95e3bac	15B	ECONOMY	15	B	{}	f
af8d9ad6-f5e2-47b3-9828-4d66ae4b4bac	a5c588e1-b27d-4401-a431-f3d9a95e3bac	15C	ECONOMY	15	C	{}	f
4dbfcc5f-5d3b-49e5-8e6a-8235a69e6425	a5c588e1-b27d-4401-a431-f3d9a95e3bac	15D	ECONOMY	15	D	{}	f
84786e2a-8971-4f25-94bb-f913be67d51f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	15E	ECONOMY	15	E	{}	f
f2e60c1d-f609-44c2-a170-903e3e174086	a5c588e1-b27d-4401-a431-f3d9a95e3bac	15F	ECONOMY	15	F	{}	f
8726e496-b146-4c2a-8102-2ba2c272576e	a5c588e1-b27d-4401-a431-f3d9a95e3bac	16A	ECONOMY	16	A	{}	f
ae1b01b1-d61b-4b3a-85ee-d4f7ddabe704	a5c588e1-b27d-4401-a431-f3d9a95e3bac	16B	ECONOMY	16	B	{}	f
fe07956e-31c0-4b4a-aeb3-a10f19ee6690	a5c588e1-b27d-4401-a431-f3d9a95e3bac	16C	ECONOMY	16	C	{}	f
70a1f390-110e-470c-870e-e96a797b548b	a5c588e1-b27d-4401-a431-f3d9a95e3bac	16D	ECONOMY	16	D	{}	f
25e783ba-9268-4be6-bec9-353d45ea2399	a5c588e1-b27d-4401-a431-f3d9a95e3bac	16E	ECONOMY	16	E	{}	f
d1f5cf68-3f2e-4094-8cfd-7bd96709d9c5	a5c588e1-b27d-4401-a431-f3d9a95e3bac	16F	ECONOMY	16	F	{}	f
b1e9bfab-c578-41a5-9b1c-b63e7055b720	a5c588e1-b27d-4401-a431-f3d9a95e3bac	17A	ECONOMY	17	A	{}	f
f8430dc9-ac1e-4b4c-b7c6-cc6691ac3b52	a5c588e1-b27d-4401-a431-f3d9a95e3bac	17B	ECONOMY	17	B	{}	f
af18f0f7-ed3e-4672-a7a7-934d6fd0b186	a5c588e1-b27d-4401-a431-f3d9a95e3bac	17C	ECONOMY	17	C	{}	f
45ebe2e3-92b7-491b-b0a0-1bd78174cc3d	a5c588e1-b27d-4401-a431-f3d9a95e3bac	17D	ECONOMY	17	D	{}	f
23b650ce-3658-4b1c-b061-352af4c05348	a5c588e1-b27d-4401-a431-f3d9a95e3bac	17E	ECONOMY	17	E	{}	f
22613060-f46e-44d8-a5b5-ae9799aa5591	a5c588e1-b27d-4401-a431-f3d9a95e3bac	17F	ECONOMY	17	F	{}	f
fb280917-a4a5-4e87-9702-c5dc21d0e339	a5c588e1-b27d-4401-a431-f3d9a95e3bac	18A	ECONOMY	18	A	{}	f
9b75a3c4-94e0-4ab6-84a2-ff9fbf450fc9	a5c588e1-b27d-4401-a431-f3d9a95e3bac	18B	ECONOMY	18	B	{}	f
e9122b6e-8e8c-4c50-9eed-73c25f1fb889	a5c588e1-b27d-4401-a431-f3d9a95e3bac	18C	ECONOMY	18	C	{}	f
192b4300-4e4a-40fe-88b2-6089d482f38c	a5c588e1-b27d-4401-a431-f3d9a95e3bac	18D	ECONOMY	18	D	{}	f
515b1863-c910-4367-aa99-185e83b21165	a5c588e1-b27d-4401-a431-f3d9a95e3bac	18E	ECONOMY	18	E	{}	f
1dbb02b7-c94a-4ea3-807c-6a4a22d35010	a5c588e1-b27d-4401-a431-f3d9a95e3bac	18F	ECONOMY	18	F	{}	f
28d8023e-c1f9-480f-9ec6-5147a5b18e91	a5c588e1-b27d-4401-a431-f3d9a95e3bac	19A	ECONOMY	19	A	{}	f
ff445b93-8eb0-46a1-afe9-6c5274ddae78	a5c588e1-b27d-4401-a431-f3d9a95e3bac	19B	ECONOMY	19	B	{}	f
3fb943fc-4a84-4c56-bfd0-8fa9545de48a	a5c588e1-b27d-4401-a431-f3d9a95e3bac	19C	ECONOMY	19	C	{}	f
4cef7e81-792f-4159-b972-f961c167fb77	a5c588e1-b27d-4401-a431-f3d9a95e3bac	19D	ECONOMY	19	D	{}	f
454a8a99-b788-4b12-9932-84ce714b4dfc	a5c588e1-b27d-4401-a431-f3d9a95e3bac	19E	ECONOMY	19	E	{}	f
de8e8eba-5262-4ad0-95a6-c26287eda434	a5c588e1-b27d-4401-a431-f3d9a95e3bac	19F	ECONOMY	19	F	{}	f
ef0c9e86-0fd8-433e-809c-e29294271f1a	a5c588e1-b27d-4401-a431-f3d9a95e3bac	20A	ECONOMY	20	A	{}	f
fe827369-c536-4c18-b0d5-76d133f4f539	a5c588e1-b27d-4401-a431-f3d9a95e3bac	20B	ECONOMY	20	B	{}	f
a64577ca-84d1-4ebd-a6e0-18206c7fbd7a	a5c588e1-b27d-4401-a431-f3d9a95e3bac	20C	ECONOMY	20	C	{}	f
cf0ec290-7710-43ba-9af6-40b567faada4	a5c588e1-b27d-4401-a431-f3d9a95e3bac	20D	ECONOMY	20	D	{}	f
2a6e5a7f-3f50-4835-997a-e865f77b0317	a5c588e1-b27d-4401-a431-f3d9a95e3bac	20E	ECONOMY	20	E	{}	f
5333087f-9764-4381-9fb6-eeb9a2078f99	a5c588e1-b27d-4401-a431-f3d9a95e3bac	20F	ECONOMY	20	F	{}	f
d2bf748c-4dc8-4b04-a3a4-70e5260348a9	a5c588e1-b27d-4401-a431-f3d9a95e3bac	21A	ECONOMY	21	A	{}	f
97150baa-d17b-4376-9766-cf93a01409c2	a5c588e1-b27d-4401-a431-f3d9a95e3bac	21B	ECONOMY	21	B	{}	f
c3629f4c-7e1e-456b-b090-36737383a98e	a5c588e1-b27d-4401-a431-f3d9a95e3bac	21C	ECONOMY	21	C	{}	f
83a8d247-fe7e-437a-9fdc-971d73ad6cc8	a5c588e1-b27d-4401-a431-f3d9a95e3bac	21D	ECONOMY	21	D	{}	f
e353dab4-f981-456c-bed4-8ae675d7f1bb	a5c588e1-b27d-4401-a431-f3d9a95e3bac	21E	ECONOMY	21	E	{}	f
cfe59b58-11b1-4594-a550-25f3bfaf13d1	a5c588e1-b27d-4401-a431-f3d9a95e3bac	21F	ECONOMY	21	F	{}	f
9c478def-c0f5-4068-b079-1721eed5d9f9	a5c588e1-b27d-4401-a431-f3d9a95e3bac	22A	ECONOMY	22	A	{}	f
ebb619f8-575e-45f1-a67d-fa2bd0295167	a5c588e1-b27d-4401-a431-f3d9a95e3bac	22B	ECONOMY	22	B	{}	f
da4a1f2b-0d90-4451-b4d3-61860e6bae6b	a5c588e1-b27d-4401-a431-f3d9a95e3bac	22C	ECONOMY	22	C	{}	f
51a11678-e324-4e0e-81a3-4b31966f98ea	a5c588e1-b27d-4401-a431-f3d9a95e3bac	22D	ECONOMY	22	D	{}	f
cdad5734-cce0-4c4d-ad42-dfbe68d03863	a5c588e1-b27d-4401-a431-f3d9a95e3bac	22E	ECONOMY	22	E	{}	f
5addad07-80b7-4920-8eac-e1951a06d3ec	a5c588e1-b27d-4401-a431-f3d9a95e3bac	22F	ECONOMY	22	F	{}	f
00bbe478-0696-411a-9973-fe146504837e	a5c588e1-b27d-4401-a431-f3d9a95e3bac	23A	ECONOMY	23	A	{}	f
8e2e7350-85d9-40df-9e45-b62260d11734	a5c588e1-b27d-4401-a431-f3d9a95e3bac	23B	ECONOMY	23	B	{}	f
0c0126f3-5dd4-4a4b-afb8-6e75a93940cb	a5c588e1-b27d-4401-a431-f3d9a95e3bac	23C	ECONOMY	23	C	{}	f
4da94b72-f7c6-4021-b477-66b9194bd50c	a5c588e1-b27d-4401-a431-f3d9a95e3bac	23D	ECONOMY	23	D	{}	f
1b7bd61d-1641-47e7-a53a-c900218d17c4	a5c588e1-b27d-4401-a431-f3d9a95e3bac	23E	ECONOMY	23	E	{}	f
059b5f1c-7307-4033-8c7e-e3ad2488188b	a5c588e1-b27d-4401-a431-f3d9a95e3bac	23F	ECONOMY	23	F	{}	f
338da1a1-35e3-4db3-a757-119e0de1247f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	24A	ECONOMY	24	A	{}	f
934c14ee-a420-4eb0-87bf-f3324d66f41b	a5c588e1-b27d-4401-a431-f3d9a95e3bac	24B	ECONOMY	24	B	{}	f
2be38139-e3b2-4391-88d0-238e96a85953	a5c588e1-b27d-4401-a431-f3d9a95e3bac	24C	ECONOMY	24	C	{}	f
4218ad2c-9af2-4873-9651-8243a9e7a9ad	a5c588e1-b27d-4401-a431-f3d9a95e3bac	24D	ECONOMY	24	D	{}	f
f564baa8-13ab-454b-ab03-3746e6b5ddf7	a5c588e1-b27d-4401-a431-f3d9a95e3bac	24E	ECONOMY	24	E	{}	f
b8329c42-73ca-4d4e-adf4-61cd3603d6c9	a5c588e1-b27d-4401-a431-f3d9a95e3bac	24F	ECONOMY	24	F	{}	f
91163cd4-f798-4aa3-b089-837aa13b52a1	a5c588e1-b27d-4401-a431-f3d9a95e3bac	25A	ECONOMY	25	A	{}	t
f6b4dadd-55e1-4380-b943-00e51f11fcb3	a5c588e1-b27d-4401-a431-f3d9a95e3bac	25B	ECONOMY	25	B	{}	t
6fe3de57-0a0d-48c0-8e5b-3a58f4b30756	a5c588e1-b27d-4401-a431-f3d9a95e3bac	25C	ECONOMY	25	C	{}	t
16d80885-cc7f-4935-9bdb-c941aec1da76	a5c588e1-b27d-4401-a431-f3d9a95e3bac	25D	ECONOMY	25	D	{}	t
7a17c23c-5815-47a0-9828-4395d955850d	a5c588e1-b27d-4401-a431-f3d9a95e3bac	25E	ECONOMY	25	E	{}	t
72cad7b9-4f3a-4877-86fe-9ac4b6f92f06	a5c588e1-b27d-4401-a431-f3d9a95e3bac	25F	ECONOMY	25	F	{}	t
417da253-fd24-4e0e-9bd2-fcf701af677d	a5c588e1-b27d-4401-a431-f3d9a95e3bac	26A	ECONOMY	26	A	{}	f
3109e6a9-6f19-4631-b035-448183fccc9c	a5c588e1-b27d-4401-a431-f3d9a95e3bac	26B	ECONOMY	26	B	{}	f
114f2239-defc-4384-a7a7-148e0eaeccd8	a5c588e1-b27d-4401-a431-f3d9a95e3bac	26C	ECONOMY	26	C	{}	f
452a4d9e-2fd5-4d8e-993c-a18f2a24cab3	a5c588e1-b27d-4401-a431-f3d9a95e3bac	26D	ECONOMY	26	D	{}	f
4a216fe2-3d5d-4ce1-b6a1-4e28e5579f4e	a5c588e1-b27d-4401-a431-f3d9a95e3bac	26E	ECONOMY	26	E	{}	f
0b462df6-c56c-45ad-9e7f-238e71638551	a5c588e1-b27d-4401-a431-f3d9a95e3bac	26F	ECONOMY	26	F	{}	f
cdbc2204-2868-47b1-af8a-de49f79fc997	a5c588e1-b27d-4401-a431-f3d9a95e3bac	27A	ECONOMY	27	A	{}	f
a7db8341-51b7-4624-ab6e-b6dbf68e4e27	a5c588e1-b27d-4401-a431-f3d9a95e3bac	27B	ECONOMY	27	B	{}	f
237dcbfd-238f-4ab8-a632-526645355b31	a5c588e1-b27d-4401-a431-f3d9a95e3bac	27C	ECONOMY	27	C	{}	f
03c943e6-f9c1-4933-8f13-0a277545a964	a5c588e1-b27d-4401-a431-f3d9a95e3bac	27D	ECONOMY	27	D	{}	f
521f288e-9913-46ea-9ae3-7ad3367231f4	a5c588e1-b27d-4401-a431-f3d9a95e3bac	27E	ECONOMY	27	E	{}	f
aa487feb-b1f6-48b3-8de1-6f00f048cfe6	a5c588e1-b27d-4401-a431-f3d9a95e3bac	27F	ECONOMY	27	F	{}	f
4efa1f95-17f6-4ef3-b144-3b1cfb35f7f7	a5c588e1-b27d-4401-a431-f3d9a95e3bac	28A	ECONOMY	28	A	{}	f
62c1f434-fa13-4f4b-aee0-bac4d2dba06d	a5c588e1-b27d-4401-a431-f3d9a95e3bac	28B	ECONOMY	28	B	{}	f
2b3eda54-3474-4eab-a533-66ba14ff2abe	a5c588e1-b27d-4401-a431-f3d9a95e3bac	28C	ECONOMY	28	C	{}	f
7e3bd79b-2f9b-4501-bfe3-38444e40fa3d	a5c588e1-b27d-4401-a431-f3d9a95e3bac	28D	ECONOMY	28	D	{}	f
ad1a0fc4-1901-4976-9146-90445bb451af	a5c588e1-b27d-4401-a431-f3d9a95e3bac	28E	ECONOMY	28	E	{}	f
2266edcf-d4d1-4b99-be1f-e7aa719b6037	a5c588e1-b27d-4401-a431-f3d9a95e3bac	28F	ECONOMY	28	F	{}	f
64381237-535b-4b5d-86d4-47dbe6a2207f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	29A	ECONOMY	29	A	{}	f
e3bbeb2f-f3ba-4c5e-b220-07ece006a23e	a5c588e1-b27d-4401-a431-f3d9a95e3bac	29B	ECONOMY	29	B	{}	f
a32aa49b-b23e-4299-9157-00f99bdd6935	a5c588e1-b27d-4401-a431-f3d9a95e3bac	29C	ECONOMY	29	C	{}	f
48420ba2-d981-4099-8f1a-030bc59c6831	a5c588e1-b27d-4401-a431-f3d9a95e3bac	29D	ECONOMY	29	D	{}	f
8657f8bf-57ee-4abe-b4b4-21d9623fd741	a5c588e1-b27d-4401-a431-f3d9a95e3bac	29E	ECONOMY	29	E	{}	f
df4ba7f2-2e62-4072-951c-7adf3e50d5e6	a5c588e1-b27d-4401-a431-f3d9a95e3bac	29F	ECONOMY	29	F	{}	f
24a8372e-6bfa-4f3d-bab6-6f7163542a78	a5c588e1-b27d-4401-a431-f3d9a95e3bac	30A	ECONOMY	30	A	{}	f
dc26461f-b320-4ee7-abb9-39cb21f505a8	a5c588e1-b27d-4401-a431-f3d9a95e3bac	30B	ECONOMY	30	B	{}	f
2368e837-b0b9-40e9-a85f-9eb2404f31a6	a5c588e1-b27d-4401-a431-f3d9a95e3bac	30C	ECONOMY	30	C	{}	f
3f82693f-f411-4312-a423-73f0372f465a	a5c588e1-b27d-4401-a431-f3d9a95e3bac	30D	ECONOMY	30	D	{}	f
62b2323d-5f26-4280-9f25-e6cea310bf57	a5c588e1-b27d-4401-a431-f3d9a95e3bac	30E	ECONOMY	30	E	{}	f
89ed1c4b-eefe-4038-adc2-218020a0394a	a5c588e1-b27d-4401-a431-f3d9a95e3bac	30F	ECONOMY	30	F	{}	f
0e3e21f3-9f76-4543-a11a-475899537fdf	a5c588e1-b27d-4401-a431-f3d9a95e3bac	31A	ECONOMY	31	A	{}	f
81f78f5c-18b5-4676-88a9-182f5912673e	a5c588e1-b27d-4401-a431-f3d9a95e3bac	31B	ECONOMY	31	B	{}	f
a9674c63-f833-4abf-abcc-ab17fc6a4813	a5c588e1-b27d-4401-a431-f3d9a95e3bac	31C	ECONOMY	31	C	{}	f
31d3999e-c36a-44e3-920f-82786f05c529	a5c588e1-b27d-4401-a431-f3d9a95e3bac	31D	ECONOMY	31	D	{}	f
0a86079d-98f0-496b-acdb-5dfe792e77fa	a5c588e1-b27d-4401-a431-f3d9a95e3bac	31E	ECONOMY	31	E	{}	f
f389f869-ea6c-409d-9913-53a4cfe1413a	a5c588e1-b27d-4401-a431-f3d9a95e3bac	31F	ECONOMY	31	F	{}	f
034a76c9-2dc5-4537-91de-71eaf50f2067	a5c588e1-b27d-4401-a431-f3d9a95e3bac	32A	ECONOMY	32	A	{}	f
92418774-9cac-4fba-8ce4-65b96c625e7d	a5c588e1-b27d-4401-a431-f3d9a95e3bac	32B	ECONOMY	32	B	{}	f
a96ac2b4-55c9-4ce1-8d3e-dd3c74cf2963	a5c588e1-b27d-4401-a431-f3d9a95e3bac	32C	ECONOMY	32	C	{}	f
0369a1fe-06a0-4176-bd4e-4a0d3ddde38a	a5c588e1-b27d-4401-a431-f3d9a95e3bac	32D	ECONOMY	32	D	{}	f
fd5de8ed-7839-4cd3-855b-3e7cd2f145ff	a5c588e1-b27d-4401-a431-f3d9a95e3bac	32E	ECONOMY	32	E	{}	f
6013ee1b-c6f9-425c-b51d-8b0b77ae99dd	a5c588e1-b27d-4401-a431-f3d9a95e3bac	32F	ECONOMY	32	F	{}	f
ed5633c2-ac83-42b7-a39d-c88af842bc51	a5c588e1-b27d-4401-a431-f3d9a95e3bac	33A	ECONOMY	33	A	{}	f
f7cad952-6f4b-4b4f-adf3-a5cf99777d93	a5c588e1-b27d-4401-a431-f3d9a95e3bac	33B	ECONOMY	33	B	{}	f
2d818145-0dde-4c36-90b4-84aad81293f5	a5c588e1-b27d-4401-a431-f3d9a95e3bac	33C	ECONOMY	33	C	{}	f
88ac396e-a387-4ea1-b130-d70422658444	a5c588e1-b27d-4401-a431-f3d9a95e3bac	33D	ECONOMY	33	D	{}	f
ac2c9160-d2af-4db5-a82a-d1cec0e0911f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	33E	ECONOMY	33	E	{}	f
05d27580-f154-40db-831f-4cfb88e9e6fb	a5c588e1-b27d-4401-a431-f3d9a95e3bac	33F	ECONOMY	33	F	{}	f
96f1b84a-b660-4669-bd5c-dfb866369acc	a5c588e1-b27d-4401-a431-f3d9a95e3bac	34A	ECONOMY	34	A	{}	f
f0fc7be4-8de8-433f-b1ea-a207847518ad	a5c588e1-b27d-4401-a431-f3d9a95e3bac	34B	ECONOMY	34	B	{}	f
6a9bd53f-7532-4074-a078-11b5768c9c64	a5c588e1-b27d-4401-a431-f3d9a95e3bac	34C	ECONOMY	34	C	{}	f
5429cc18-e575-46e2-aeae-bf54d2bdd8b0	a5c588e1-b27d-4401-a431-f3d9a95e3bac	34D	ECONOMY	34	D	{}	f
bef90cd7-1d7c-4f87-b5d0-b9ab483bcaf8	a5c588e1-b27d-4401-a431-f3d9a95e3bac	34E	ECONOMY	34	E	{}	f
f44e6a12-a766-44b4-9c0a-200157463962	a5c588e1-b27d-4401-a431-f3d9a95e3bac	34F	ECONOMY	34	F	{}	f
f84a2470-c41b-4c32-ab35-fe659fe32e1f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	35A	ECONOMY	35	A	{}	f
bbffc3bd-9c9e-4ddc-890a-8d7319fd0eb0	a5c588e1-b27d-4401-a431-f3d9a95e3bac	35B	ECONOMY	35	B	{}	f
4ec8706b-7226-46d5-88a4-30e96f591265	a5c588e1-b27d-4401-a431-f3d9a95e3bac	35C	ECONOMY	35	C	{}	f
0a45bf8c-a0d5-4ce0-994e-6127acba3d22	a5c588e1-b27d-4401-a431-f3d9a95e3bac	35D	ECONOMY	35	D	{}	f
60f14028-b5a5-4451-ba16-be400c895c64	a5c588e1-b27d-4401-a431-f3d9a95e3bac	35E	ECONOMY	35	E	{}	f
ee196001-3d93-44e9-b501-dff956f5766d	a5c588e1-b27d-4401-a431-f3d9a95e3bac	35F	ECONOMY	35	F	{}	f
60c2428f-2461-4b7a-96f8-2e462f5ca1c3	a5c588e1-b27d-4401-a431-f3d9a95e3bac	36A	ECONOMY	36	A	{}	f
b492c4fa-8c03-46d9-a1e6-2198d8050d2c	a5c588e1-b27d-4401-a431-f3d9a95e3bac	36B	ECONOMY	36	B	{}	f
bd0fd2a0-1b05-4c90-9092-7264b58e69cc	a5c588e1-b27d-4401-a431-f3d9a95e3bac	36C	ECONOMY	36	C	{}	f
6017d60e-d1e6-44a2-a231-0dc643986399	a5c588e1-b27d-4401-a431-f3d9a95e3bac	36D	ECONOMY	36	D	{}	f
730e9b51-6530-446f-b2ba-9330df369136	a5c588e1-b27d-4401-a431-f3d9a95e3bac	36E	ECONOMY	36	E	{}	f
bc653aa3-d2fd-4c18-86f6-24a25e25fef6	a5c588e1-b27d-4401-a431-f3d9a95e3bac	36F	ECONOMY	36	F	{}	f
d3d3bf2a-7ff8-4778-9f42-9a409c6c23ff	a5c588e1-b27d-4401-a431-f3d9a95e3bac	37A	ECONOMY	37	A	{}	f
6f994385-07c4-4133-b3f8-8849cd71a6da	a5c588e1-b27d-4401-a431-f3d9a95e3bac	37B	ECONOMY	37	B	{}	f
9e939ceb-1067-4fa1-8b9a-b0f40c31ead3	a5c588e1-b27d-4401-a431-f3d9a95e3bac	37C	ECONOMY	37	C	{}	f
a78ea49c-f17b-4513-8ef9-3dc58c716bdf	a5c588e1-b27d-4401-a431-f3d9a95e3bac	37D	ECONOMY	37	D	{}	f
47edf31b-8753-4e47-8c43-c3c49ddd90e8	a5c588e1-b27d-4401-a431-f3d9a95e3bac	37E	ECONOMY	37	E	{}	f
6cd8e12c-4e44-49b1-9ce5-83d44e1ae8d8	a5c588e1-b27d-4401-a431-f3d9a95e3bac	37F	ECONOMY	37	F	{}	f
a9ba59c7-216f-4d82-8db9-121f7b86e7b5	a5c588e1-b27d-4401-a431-f3d9a95e3bac	38A	ECONOMY	38	A	{}	f
7df8c6af-5a21-4203-b30a-2d89e5df84c3	a5c588e1-b27d-4401-a431-f3d9a95e3bac	38B	ECONOMY	38	B	{}	f
853133c9-aa43-4aa1-858f-1014cdc1d024	a5c588e1-b27d-4401-a431-f3d9a95e3bac	38C	ECONOMY	38	C	{}	f
70f83919-56e3-4c7a-a5b3-011f78771967	a5c588e1-b27d-4401-a431-f3d9a95e3bac	38D	ECONOMY	38	D	{}	f
81b6a197-642d-4e3a-b485-93de2bb44bd8	a5c588e1-b27d-4401-a431-f3d9a95e3bac	38E	ECONOMY	38	E	{}	f
0d628621-ece5-43d4-b8d2-dffd1aa602f9	a5c588e1-b27d-4401-a431-f3d9a95e3bac	38F	ECONOMY	38	F	{}	f
cea648f5-9aa1-40a9-a2da-df710244b98f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	39A	ECONOMY	39	A	{}	f
16f15e01-71ed-4963-b4d8-e503ef476dc9	a5c588e1-b27d-4401-a431-f3d9a95e3bac	39B	ECONOMY	39	B	{}	f
4538e144-0424-4b8c-be5b-89f5db3cb887	a5c588e1-b27d-4401-a431-f3d9a95e3bac	39C	ECONOMY	39	C	{}	f
b627b8ec-cc38-46e2-8d9c-a07fe1ab78cb	a5c588e1-b27d-4401-a431-f3d9a95e3bac	39D	ECONOMY	39	D	{}	f
9f295c16-8b22-4582-a67a-36ee1cb7b1a1	a5c588e1-b27d-4401-a431-f3d9a95e3bac	39E	ECONOMY	39	E	{}	f
31deb5e7-3a99-4766-b3a5-d969d3397aa9	a5c588e1-b27d-4401-a431-f3d9a95e3bac	39F	ECONOMY	39	F	{}	f
fbfa8035-4e2f-45f0-800f-e0e53bb2c2c6	a5c588e1-b27d-4401-a431-f3d9a95e3bac	40A	ECONOMY	40	A	{}	f
96b4143d-307d-401f-b25b-ee4a5e173bfa	a5c588e1-b27d-4401-a431-f3d9a95e3bac	40B	ECONOMY	40	B	{}	f
43221ae9-9c55-4465-99b1-6380759dab3e	a5c588e1-b27d-4401-a431-f3d9a95e3bac	40C	ECONOMY	40	C	{}	f
8decba0d-b32a-435d-86e9-56393079a554	a5c588e1-b27d-4401-a431-f3d9a95e3bac	40D	ECONOMY	40	D	{}	f
1f4cc40e-ee43-441a-a0db-7f6149eeb138	a5c588e1-b27d-4401-a431-f3d9a95e3bac	40E	ECONOMY	40	E	{}	f
6d143e93-a46b-4c85-a9e9-cbbd24a20ffb	a5c588e1-b27d-4401-a431-f3d9a95e3bac	40F	ECONOMY	40	F	{}	f
1712d551-f75a-4a91-adfd-f1d5c2897ac7	a5c588e1-b27d-4401-a431-f3d9a95e3bac	41A	ECONOMY	41	A	{}	f
7d1b3407-d822-4602-bb4b-2e22e9842e91	a5c588e1-b27d-4401-a431-f3d9a95e3bac	41B	ECONOMY	41	B	{}	f
0c10ed8a-1a5f-4608-8fc6-17149858a815	a5c588e1-b27d-4401-a431-f3d9a95e3bac	41C	ECONOMY	41	C	{}	f
f470851b-ef70-4763-a95a-e7b401d976fc	a5c588e1-b27d-4401-a431-f3d9a95e3bac	41D	ECONOMY	41	D	{}	f
5cc911a9-0e61-4d2d-adea-334bb01f4f19	a5c588e1-b27d-4401-a431-f3d9a95e3bac	41E	ECONOMY	41	E	{}	f
e552f8f0-3d72-46f8-8855-2713a7eb5100	a5c588e1-b27d-4401-a431-f3d9a95e3bac	41F	ECONOMY	41	F	{}	f
f7606c64-c161-4789-b2eb-53a9dea25618	a5c588e1-b27d-4401-a431-f3d9a95e3bac	42A	ECONOMY	42	A	{}	f
0f380c20-fe20-4fce-82d2-9dc5e6c54342	a5c588e1-b27d-4401-a431-f3d9a95e3bac	42B	ECONOMY	42	B	{}	f
42e64fcc-3d1c-410d-bb8f-c46e089c76c2	a5c588e1-b27d-4401-a431-f3d9a95e3bac	42C	ECONOMY	42	C	{}	f
794d25ab-4fed-41d2-af74-3fdf387e1351	a5c588e1-b27d-4401-a431-f3d9a95e3bac	42D	ECONOMY	42	D	{}	f
186c566b-3821-4098-8ce0-db290aae96f3	a5c588e1-b27d-4401-a431-f3d9a95e3bac	42E	ECONOMY	42	E	{}	f
38dbafe1-08bb-4a8d-bb63-d553bdce79d7	a5c588e1-b27d-4401-a431-f3d9a95e3bac	42F	ECONOMY	42	F	{}	f
29acf4e9-b105-41fe-bcc3-d79c77f1b22a	a5c588e1-b27d-4401-a431-f3d9a95e3bac	43A	ECONOMY	43	A	{}	f
9d78cf14-cd90-4308-bf05-2d1462888f30	a5c588e1-b27d-4401-a431-f3d9a95e3bac	43B	ECONOMY	43	B	{}	f
0a17d529-0130-41f1-96e5-2cfeccad4461	a5c588e1-b27d-4401-a431-f3d9a95e3bac	43C	ECONOMY	43	C	{}	f
fe98be5f-e8f5-4e61-ad29-40a63795d539	a5c588e1-b27d-4401-a431-f3d9a95e3bac	43D	ECONOMY	43	D	{}	f
9900d4cb-cf04-4636-b5c5-86061b3d18e3	a5c588e1-b27d-4401-a431-f3d9a95e3bac	43E	ECONOMY	43	E	{}	f
d9f78900-c15c-4fb3-a823-d9cbde8419ac	a5c588e1-b27d-4401-a431-f3d9a95e3bac	43F	ECONOMY	43	F	{}	f
89bee68b-07c5-43f4-ba76-18279735bf42	a5c588e1-b27d-4401-a431-f3d9a95e3bac	44A	ECONOMY	44	A	{}	f
76d6d56d-5149-4465-bbf4-fb105fd14b84	a5c588e1-b27d-4401-a431-f3d9a95e3bac	44B	ECONOMY	44	B	{}	f
247489af-aea1-4c28-b04c-4cc476211f69	a5c588e1-b27d-4401-a431-f3d9a95e3bac	44C	ECONOMY	44	C	{}	f
3f4fac26-a4ac-4295-9a51-4c80556f432f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	44D	ECONOMY	44	D	{}	f
63ff2c29-b0c5-48b1-85c8-7e314e7ef3c4	a5c588e1-b27d-4401-a431-f3d9a95e3bac	44E	ECONOMY	44	E	{}	f
02b14660-3550-48ac-a79a-df01a26f9aa3	a5c588e1-b27d-4401-a431-f3d9a95e3bac	44F	ECONOMY	44	F	{}	f
6023addb-c990-4ce8-8c66-a76ea2c2a0d5	a5c588e1-b27d-4401-a431-f3d9a95e3bac	45A	ECONOMY	45	A	{}	f
ceb13b28-e2e5-44ab-a8b4-1cfeb7f8b87c	a5c588e1-b27d-4401-a431-f3d9a95e3bac	45B	ECONOMY	45	B	{}	f
196d7467-e062-41bd-8bab-a2afb6d512b8	a5c588e1-b27d-4401-a431-f3d9a95e3bac	45C	ECONOMY	45	C	{}	f
0c08d012-406b-4e50-a910-e8dee4d59ea9	a5c588e1-b27d-4401-a431-f3d9a95e3bac	45D	ECONOMY	45	D	{}	f
31754f4b-0ae9-4a82-b331-010ec563d11d	a5c588e1-b27d-4401-a431-f3d9a95e3bac	45E	ECONOMY	45	E	{}	f
c992e2ba-632a-47ac-9952-72c553578913	a5c588e1-b27d-4401-a431-f3d9a95e3bac	45F	ECONOMY	45	F	{}	f
51788019-3950-48e5-9716-be801d9ee1fd	a5c588e1-b27d-4401-a431-f3d9a95e3bac	46A	ECONOMY	46	A	{}	f
fe6dde28-1085-4cef-ba11-495144236685	a5c588e1-b27d-4401-a431-f3d9a95e3bac	46B	ECONOMY	46	B	{}	f
424cc68d-8a27-480b-ad2c-67e6f10cd60c	a5c588e1-b27d-4401-a431-f3d9a95e3bac	46C	ECONOMY	46	C	{}	f
2c6da3cd-3e63-42a5-b5ef-b08687773862	a5c588e1-b27d-4401-a431-f3d9a95e3bac	46D	ECONOMY	46	D	{}	f
ad72227b-7d57-41d9-b295-5f6807e93e42	a5c588e1-b27d-4401-a431-f3d9a95e3bac	46E	ECONOMY	46	E	{}	f
b1f77020-0812-43d6-b0a6-5dc9bd92891b	a5c588e1-b27d-4401-a431-f3d9a95e3bac	46F	ECONOMY	46	F	{}	f
143e2ed2-bb07-464b-a925-99f5992885f1	a5c588e1-b27d-4401-a431-f3d9a95e3bac	47A	ECONOMY	47	A	{}	f
3232d512-f350-49e8-bfc8-e0d5ebb03ed0	a5c588e1-b27d-4401-a431-f3d9a95e3bac	47B	ECONOMY	47	B	{}	f
9d54c678-a6ce-42c4-b3e9-cbe4c0fa3ec2	a5c588e1-b27d-4401-a431-f3d9a95e3bac	47C	ECONOMY	47	C	{}	f
5a40f50e-3d55-4d4e-927d-455408fa35ac	a5c588e1-b27d-4401-a431-f3d9a95e3bac	47D	ECONOMY	47	D	{}	f
90cd35aa-6bf3-4655-b6dd-493b141de5b3	a5c588e1-b27d-4401-a431-f3d9a95e3bac	47E	ECONOMY	47	E	{}	f
fd40d458-7ec0-4807-be3f-01927e7b1a6e	a5c588e1-b27d-4401-a431-f3d9a95e3bac	47F	ECONOMY	47	F	{}	f
039ce5f9-688f-4eed-b8d9-e92881507dff	a5c588e1-b27d-4401-a431-f3d9a95e3bac	48A	ECONOMY	48	A	{}	f
d97f5b5f-cc14-4f4f-80de-e098b2c66207	a5c588e1-b27d-4401-a431-f3d9a95e3bac	48B	ECONOMY	48	B	{}	f
b5261935-a21d-440d-86aa-28202ef803d0	a5c588e1-b27d-4401-a431-f3d9a95e3bac	48C	ECONOMY	48	C	{}	f
5a5fe721-d640-4d0d-b411-715d5728724a	a5c588e1-b27d-4401-a431-f3d9a95e3bac	48D	ECONOMY	48	D	{}	f
827598c3-05cf-458a-8f32-ebc8082a6f07	a5c588e1-b27d-4401-a431-f3d9a95e3bac	48E	ECONOMY	48	E	{}	f
97d7ca91-26f2-4f74-a335-c36415922efe	a5c588e1-b27d-4401-a431-f3d9a95e3bac	48F	ECONOMY	48	F	{}	f
b3746956-dfda-4f24-94c1-de96c376ef56	a5c588e1-b27d-4401-a431-f3d9a95e3bac	49A	ECONOMY	49	A	{}	f
fb6f6461-ee39-4db4-ab23-1b151b4c900d	a5c588e1-b27d-4401-a431-f3d9a95e3bac	49B	ECONOMY	49	B	{}	f
8323d975-6b2b-4b05-abfd-e8bbb15fcb50	a5c588e1-b27d-4401-a431-f3d9a95e3bac	49C	ECONOMY	49	C	{}	f
c19ed070-ff5e-4884-a920-a7b3ddedd000	a5c588e1-b27d-4401-a431-f3d9a95e3bac	49D	ECONOMY	49	D	{}	f
a9a21a90-a655-4ecf-af85-5e2efcf63080	a5c588e1-b27d-4401-a431-f3d9a95e3bac	49E	ECONOMY	49	E	{}	f
0e559dc3-d675-4d70-a405-2e5f0deb2af0	a5c588e1-b27d-4401-a431-f3d9a95e3bac	49F	ECONOMY	49	F	{}	f
6fe90a72-f218-4f5a-a1ea-fad45024090d	a5c588e1-b27d-4401-a431-f3d9a95e3bac	50A	ECONOMY	50	A	{}	f
1bb2ce21-2c26-48dd-86b7-8a6746461e84	a5c588e1-b27d-4401-a431-f3d9a95e3bac	50B	ECONOMY	50	B	{}	f
492a80f2-3ee7-49a6-92d1-b089d20e7ea4	a5c588e1-b27d-4401-a431-f3d9a95e3bac	50C	ECONOMY	50	C	{}	f
e5686fe3-5b53-48ab-8eb9-de0b4b0ab8b0	a5c588e1-b27d-4401-a431-f3d9a95e3bac	50D	ECONOMY	50	D	{}	f
7463a2d3-c0e3-45a3-9c64-92f9f29d0398	a5c588e1-b27d-4401-a431-f3d9a95e3bac	50E	ECONOMY	50	E	{}	f
5c91a4d8-a479-4f59-84e4-44b5290f3ed1	a5c588e1-b27d-4401-a431-f3d9a95e3bac	50F	ECONOMY	50	F	{}	f
89757638-480a-4291-ab24-a28537f8c93f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	51A	ECONOMY	51	A	{}	f
9b6203e1-9075-4b63-ae92-649843a201dc	a5c588e1-b27d-4401-a431-f3d9a95e3bac	51B	ECONOMY	51	B	{}	f
2e6c47e7-5119-4bf1-a38d-4aee2ff56013	a5c588e1-b27d-4401-a431-f3d9a95e3bac	51C	ECONOMY	51	C	{}	f
00e91adc-e962-45a2-b709-add049e57d22	a5c588e1-b27d-4401-a431-f3d9a95e3bac	51D	ECONOMY	51	D	{}	f
2e3d2096-85f9-4f56-956c-84c6f38bb1dd	a5c588e1-b27d-4401-a431-f3d9a95e3bac	51E	ECONOMY	51	E	{}	f
77def66a-149d-4bbf-b45f-6262c39a8d47	a5c588e1-b27d-4401-a431-f3d9a95e3bac	51F	ECONOMY	51	F	{}	f
34de7be5-c63d-4154-976a-34568db6ba56	a5c588e1-b27d-4401-a431-f3d9a95e3bac	52A	ECONOMY	52	A	{}	f
e74ebd5e-80b9-45a0-8028-87420964a4ef	a5c588e1-b27d-4401-a431-f3d9a95e3bac	52B	ECONOMY	52	B	{}	f
f2bc6969-3e7a-4de5-948b-9149bb833975	a5c588e1-b27d-4401-a431-f3d9a95e3bac	52C	ECONOMY	52	C	{}	f
354d5a8e-e28d-4017-b374-0ba0d1f984f4	a5c588e1-b27d-4401-a431-f3d9a95e3bac	52D	ECONOMY	52	D	{}	f
091964a9-fbf9-4b3d-90e1-08783f92c491	a5c588e1-b27d-4401-a431-f3d9a95e3bac	52E	ECONOMY	52	E	{}	f
bc46165c-3095-4fb5-b8b3-bc5d56ebfd27	a5c588e1-b27d-4401-a431-f3d9a95e3bac	52F	ECONOMY	52	F	{}	f
eedb48aa-3b83-4761-a837-999c1bfc350f	a5c588e1-b27d-4401-a431-f3d9a95e3bac	53A	ECONOMY	53	A	{}	f
0fdd43bb-ed6b-4fec-b224-05af2e35f370	a5c588e1-b27d-4401-a431-f3d9a95e3bac	53B	ECONOMY	53	B	{}	f
b6af4655-3cff-4646-be79-a979c986aacf	a5c588e1-b27d-4401-a431-f3d9a95e3bac	53C	ECONOMY	53	C	{}	f
5f4035e3-3a37-4129-a8c8-ba89d362419d	a5c588e1-b27d-4401-a431-f3d9a95e3bac	53D	ECONOMY	53	D	{}	f
41a80ff6-026c-4bac-a367-176a99495e30	a5c588e1-b27d-4401-a431-f3d9a95e3bac	53E	ECONOMY	53	E	{}	f
d41f62df-fe21-490d-b32a-0a04b12a180a	a5c588e1-b27d-4401-a431-f3d9a95e3bac	53F	ECONOMY	53	F	{}	f
852007d7-97a5-40da-9abe-e20a996083d9	a5c588e1-b27d-4401-a431-f3d9a95e3bac	54A	ECONOMY	54	A	{}	f
\.


--
-- Data for Name: sessions; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.sessions (id, user_id, user_agent, ip_address, created_at, last_used_at, expires_at, revoked_at, revoke_reason) FROM stdin;
b923b015-5591-448f-a378-eeed3e99b0ea	9fd0f96e-5cbb-4857-87f8-66c1cafb2ceb	\N	::ffff:127.0.0.1	2026-09-30 11:58:48.52+03	2026-09-30 11:58:48.52+03	2026-10-30 10:58:48.516+02	\N	\N
7d87191a-007b-4164-832d-378feab3833d	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-09-30 12:19:18.814+03	2026-09-30 12:19:18.814+03	2026-10-30 11:19:18.813+02	2026-09-30 12:19:38.566+03	logout
305dedb8-5a5b-411e-bd3b-0f271efc530f	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-09-30 12:19:58.647+03	2026-09-30 12:19:58.647+03	2026-10-30 11:19:58.646+02	2026-09-30 12:31:41.647+03	logout
c478e950-f69b-4a1d-8e8e-d918e66d5048	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-09-30 12:49:10.053+03	2026-09-30 12:49:10.053+03	2026-10-30 11:49:10.052+02	2026-09-30 12:49:36.772+03	logout
fb856980-4416-4229-b82e-bf45fa83f126	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 12:58:27.525+03	2026-10-06 12:58:27.525+03	2026-11-05 11:58:27.524+02	2026-10-06 12:59:57.583+03	logout
15ccf45a-ab8a-43ad-9f66-bed288a233c6	e01abc5f-5343-4078-a4e0-2fdec3ee013d	curl/8.21.0	::1	2026-09-30 12:52:56.102+03	2026-09-30 12:52:56.102+03	2026-10-30 11:52:56.101+02	\N	\N
02287488-01c4-4867-98b8-cf8147328de1	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-09-30 12:52:30.212+03	2026-09-30 12:52:47.565+03	2026-10-30 11:52:30.211+02	2026-09-30 12:54:36.658+03	logout
90f7c85e-d8f2-48e3-9203-343dc50d0389	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-09-30 12:54:50.096+03	2026-09-30 12:54:50.096+03	2026-10-30 11:54:50.095+02	2026-09-30 12:56:17.56+03	logout
6f81a2f0-84e6-47b0-b79a-900a993a32ca	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-05 15:10:43.938+03	2026-10-05 16:02:34.019+03	2026-11-04 14:10:43.937+02	2026-10-05 16:07:11.99+03	logout
714cd936-ac96-4585-8d69-732ec72f232d	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0	::1	2026-09-30 22:16:34.759+03	2026-09-30 22:17:33.135+03	2026-10-30 21:16:34.758+02	\N	\N
db2ceda1-0d5d-4fd1-adb7-e75f8cfb479d	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 15:50:48.6+03	2026-10-06 15:50:48.6+03	2026-11-05 14:50:48.599+02	2026-10-06 15:57:20.914+03	logout
5ed9f33f-5d59-4a2a-9b5d-b801c1d45d18	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-05 18:27:35.979+03	2026-10-05 19:14:29.322+03	2026-11-04 17:27:35.978+02	2026-10-05 19:14:39.444+03	logout
df501df1-473f-4aa9-90f3-42fcb269898c	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-05 16:07:27.562+03	2026-10-05 18:02:44.666+03	2026-11-04 15:07:27.561+02	2026-10-05 18:02:58.41+03	logout
8f404678-b8dd-4562-8f92-46c0920b8b60	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-09-30 22:12:05.56+03	2026-10-01 16:14:01.421+03	2026-10-30 21:12:05.559+02	2026-10-01 16:16:19.764+03	logout
c87a364b-8839-45b3-a3d3-ae4fd08c417d	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-05 18:03:15.943+03	2026-10-05 18:03:22.464+03	2026-11-04 17:03:15.942+02	2026-10-05 18:03:30.353+03	logout
39597aba-f006-4143-b674-d749d9147a99	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-05 18:03:41.145+03	2026-10-05 18:03:41.145+03	2026-11-04 17:03:41.144+02	2026-10-05 18:03:41.167+03	logout
8a1a1b9c-b655-4c1d-8af3-635f41c87e69	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-05 19:14:51.182+03	2026-10-05 19:14:51.182+03	2026-11-04 18:14:51.177+02	2026-10-05 19:17:52.241+03	logout
596e8fe1-f91e-45a0-9ff6-4eb7e3391d7a	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-01 16:16:39.852+03	2026-10-05 15:10:23.633+03	2026-10-31 15:16:39.851+02	2026-10-05 15:10:23.757+03	logout
197173e9-fac5-4815-91b8-71bf752564d3	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-05 18:03:43.848+03	2026-10-05 18:19:13.683+03	2026-11-04 17:03:43.847+02	2026-10-05 18:25:39.087+03	logout
3bb340ae-1cb2-4680-b9de-9264db1e3c26	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 13:00:07.365+03	2026-10-06 13:01:27.876+03	2026-11-05 12:00:07.364+02	2026-10-06 13:01:58.562+03	logout
23ad2653-6f2b-49f8-acc9-1a0f0c5af0ce	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-05 18:25:47.853+03	2026-10-05 18:27:14.326+03	2026-11-04 17:25:47.852+02	2026-10-05 18:27:22.288+03	logout
00c39fcd-675f-4b75-805a-835cf0aabcb6	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-05 19:18:13.984+03	2026-10-06 02:00:08.993+03	2026-11-04 18:18:13.981+02	2026-10-06 02:00:55.561+03	logout
fa37f552-0917-4852-b8ae-049efa0103c8	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 14:15:22.542+03	2026-10-06 14:15:22.542+03	2026-11-05 13:15:22.539+02	2026-10-06 14:15:39.952+03	logout
3ba08ae7-eab3-40c5-83bb-52c074964cab	34eedc56-29ef-4665-87fa-648c6a23dc72	curl/8.21.0	::1	2026-10-06 14:15:55.29+03	2026-10-06 14:15:55.29+03	2026-11-05 13:15:55.287+02	\N	\N
74db8183-72c7-4a5f-99dc-376296188d70	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 02:01:03.847+03	2026-10-06 02:02:58.435+03	2026-11-05 01:01:03.846+02	2026-10-06 02:03:00.732+03	logout
67372d8a-33ab-49e1-87ae-490c9aa49394	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 02:03:22.615+03	2026-10-06 02:03:22.615+03	2026-11-05 01:03:22.614+02	2026-10-06 02:04:50.514+03	logout
cf1e1081-5126-423a-8553-6ea2956affdf	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 02:04:57.185+03	2026-10-06 12:58:01.949+03	2026-11-05 01:04:57.184+02	2026-10-06 12:58:17.823+03	logout
d672ad58-137f-4bdc-a234-8897ca28a8f0	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 14:16:02.54+03	2026-10-06 15:33:31.418+03	2026-11-05 13:16:02.537+02	2026-10-06 15:33:39.006+03	logout
f2a2423b-8f33-495a-90d6-4e9af77da2b2	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 16:32:32.188+03	2026-10-06 16:32:32.188+03	2026-11-05 15:32:32.187+02	2026-10-06 16:34:36.893+03	logout
1df797a0-59fc-4d4b-8601-05b21cca4825	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 15:33:49.932+03	2026-10-06 15:33:56.854+03	2026-11-05 14:33:49.931+02	2026-10-06 15:34:02.98+03	logout
0a0f3c46-3b6e-44e9-879a-ee9064dd7451	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 15:57:27.942+03	2026-10-06 16:01:14.641+03	2026-11-05 14:57:27.941+02	2026-10-06 16:07:42.082+03	logout
5507ffcb-ab03-48ac-9c26-56591530ee78	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 15:34:08.885+03	2026-10-06 15:49:56.582+03	2026-11-05 14:34:08.884+02	2026-10-06 15:50:33.767+03	logout
3eced300-1560-4427-80af-23841e125544	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 16:07:56.968+03	2026-10-06 16:30:21.149+03	2026-11-05 15:07:56.967+02	2026-10-06 16:30:31.502+03	logout
028a86bc-a78d-454c-9c64-bd8a92cad93a	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 16:30:42.453+03	2026-10-06 16:32:09.586+03	2026-11-05 15:30:42.451+02	2026-10-06 16:32:21.813+03	logout
6c2c3ff2-3d13-4da0-b5fa-513efb4ac201	34eedc56-29ef-4665-87fa-648c6a23dc72	curl/8.21.0	::1	2026-10-06 16:43:37.08+03	2026-10-06 16:43:37.08+03	2026-11-05 15:43:37.079+02	\N	\N
90d30fb9-e775-4838-903c-beed53e2be9e	34eedc56-29ef-4665-87fa-648c6a23dc72	curl/8.21.0	::1	2026-10-06 16:43:48.68+03	2026-10-06 16:43:48.68+03	2026-11-05 15:43:48.678+02	\N	\N
465e0914-89b2-4ea6-b6b1-ec73fe880968	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 17:33:26.47+03	2026-10-06 17:33:26.47+03	2026-11-05 16:33:26.469+02	2026-10-06 17:33:32.419+03	logout
e9db6f47-671d-4f13-9db0-bbbbafb0a0c6	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 16:34:46.389+03	2026-10-06 17:32:16.405+03	2026-11-05 15:34:46.388+02	2026-10-06 17:33:19.151+03	logout
d90f7756-9ebd-4d67-9919-a2c98947a9d9	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 17:33:39.153+03	2026-10-06 17:33:39.153+03	2026-11-05 16:33:39.151+02	2026-10-06 17:35:34.062+03	logout
e01fb126-562e-44fb-bba0-f49ed413922e	34eedc56-29ef-4665-87fa-648c6a23dc72	curl/8.21.0	::1	2026-10-06 17:41:44.406+03	2026-10-06 17:41:44.406+03	2026-11-05 16:41:44.406+02	\N	\N
d2c66474-8a6d-47ac-9c5f-ecca99a63403	34eedc56-29ef-4665-87fa-648c6a23dc72	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0	::1	2026-10-06 18:21:57.02+03	2026-10-06 18:21:57.162+03	2026-11-05 17:21:57.019+02	\N	\N
f904ca64-98f8-4345-950c-b528cee32bce	34eedc56-29ef-4665-87fa-648c6a23dc72	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0	::1	2026-10-06 18:22:49.901+03	2026-10-06 18:22:50.045+03	2026-11-05 17:22:49.9+02	\N	\N
73033c48-d89d-4c2c-93a7-1cd5579b529c	34eedc56-29ef-4665-87fa-648c6a23dc72	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0	::1	2026-10-06 18:24:09.797+03	2026-10-06 18:24:09.933+03	2026-11-05 17:24:09.796+02	\N	\N
2de71df1-8552-4eaf-bcea-baba99c0e826	34eedc56-29ef-4665-87fa-648c6a23dc72	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0	::1	2026-10-06 18:25:03.088+03	2026-10-06 18:25:03.225+03	2026-11-05 17:25:03.087+02	\N	\N
3f47cb5a-e2a4-4c9d-afc7-8fa29ff06821	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-07 14:37:52.911+03	2026-10-07 14:37:52.911+03	2026-11-06 13:37:52.909+02	2026-10-07 14:38:40.779+03	logout
67908fb0-a8b2-4e31-97b8-b700ec25cc31	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 17:57:17.355+03	2026-10-06 18:29:18.95+03	2026-11-05 16:57:17.349+02	2026-10-06 18:33:02.043+03	logout
bafc45e3-712f-44e6-978e-a3f7cdabc558	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 17:35:41.193+03	2026-10-06 17:52:39.055+03	2026-11-05 16:35:41.192+02	2026-10-06 17:52:45.786+03	logout
ff50d5ae-8f14-4d7c-bae2-baeae7261c69	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 17:53:01.825+03	2026-10-06 17:53:14.376+03	2026-11-05 16:53:01.824+02	2026-10-06 17:53:58.41+03	logout
dc2259e9-b0fa-4015-a812-cceeec09cf75	34eedc56-29ef-4665-87fa-648c6a23dc72	curl/8.21.0	::1	2026-10-06 17:54:57.592+03	2026-10-06 17:54:57.592+03	2026-11-05 16:54:57.59+02	\N	\N
29a40eff-22e2-4a28-8069-bc90061ca1b8	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-07 14:39:02.555+03	2026-10-07 14:39:02.555+03	2026-11-06 13:39:02.554+02	2026-10-07 14:41:12.264+03	logout
b55b988e-d165-4f29-897b-18b95886ec11	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 18:33:19.559+03	2026-10-06 23:41:07.733+03	2026-11-05 17:33:19.558+02	2026-10-06 23:41:14.135+03	logout
d1e2ccc6-422e-43f0-9818-50d6fc6988f9	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 23:41:26.448+03	2026-10-06 23:43:36.469+03	2026-11-05 22:41:26.443+02	2026-10-06 23:45:09.11+03	logout
0186a4de-484e-4c19-98c1-71cb05bf5c74	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 23:45:27.34+03	2026-10-06 23:45:27.34+03	2026-11-05 22:45:27.336+02	2026-10-06 23:46:30.77+03	logout
d4831ee9-3908-403a-b8d2-0434eab593ca	34eedc56-29ef-4665-87fa-648c6a23dc72	curl/8.21.0	::1	2026-10-06 18:13:53.659+03	2026-10-06 18:13:53.659+03	2026-11-05 17:13:53.647+02	\N	\N
d28b7fef-3a7e-42ae-963c-14e1e5f6a85d	34eedc56-29ef-4665-87fa-648c6a23dc72	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0	::1	2026-10-06 18:15:24.93+03	2026-10-06 18:15:25.084+03	2026-11-05 17:15:24.928+02	\N	\N
9be51f80-7168-4c38-9fe3-f071262de581	34eedc56-29ef-4665-87fa-648c6a23dc72	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0	::1	2026-10-06 18:16:41.346+03	2026-10-06 18:16:41.492+03	2026-11-05 17:16:41.346+02	\N	\N
f14f7d65-1af7-4114-bbe8-d30cca026eae	24e598b1-ee10-457d-83bc-122a7e1ba398	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-07 15:19:45.2+03	2026-10-08 14:18:53.11+03	2026-11-06 14:19:45.199+02	2026-10-08 14:19:43.18+03	logout
b9f20ea2-ccd0-4c4e-a25e-92927da7d299	34eedc56-29ef-4665-87fa-648c6a23dc72	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/154.0.0.0 Safari/537.36 Edg/154.0.0.0	::1	2026-10-06 18:21:09.351+03	2026-10-06 18:21:09.504+03	2026-11-05 17:21:09.35+02	\N	\N
195eaa6f-2e8f-4550-a588-aed9b73c2e39	24e598b1-ee10-457d-83bc-122a7e1ba398	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-07 15:06:50.016+03	2026-10-07 15:12:43.063+03	2026-11-06 14:06:50.014+02	2026-10-07 15:14:02.915+03	logout
3ae0930b-7903-438d-b13d-1c74dfd4dfe8	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-07 14:41:20.445+03	2026-10-07 14:56:46.208+03	2026-11-06 13:41:20.444+02	2026-10-07 14:57:43.839+03	logout
75cf01dc-31f1-4187-b220-1776483dced7	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36	::1	2026-10-06 23:46:37.957+03	2026-10-07 12:27:04.468+03	2026-11-05 22:46:37.944+02	2026-10-07 12:29:05.948+03	logout
02c0e66b-cb83-4770-be56-5b63fdca5c1d	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-07 12:29:16.293+03	2026-10-07 12:29:16.293+03	2026-11-06 11:29:16.292+02	2026-10-07 12:29:40.166+03	logout
5d02415a-0a80-4c8a-a65c-353af5b87744	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-07 12:29:45.12+03	2026-10-07 12:30:53.778+03	2026-11-06 11:29:45.119+02	\N	\N
bed02d1a-749e-4571-a0d2-2667df683cea	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-07 12:32:51.79+03	2026-10-07 12:32:51.79+03	2026-11-06 11:32:51.788+02	2026-10-07 12:33:13.214+03	logout
0960f211-bf12-4657-9134-de8215f96621	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-07 14:58:55.621+03	2026-10-07 14:58:55.621+03	2026-11-06 13:58:55.62+02	2026-10-07 15:02:16.131+03	logout
67cfcbf5-f607-4f98-ba77-83ed89454be0	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-07 12:33:21.938+03	2026-10-07 14:37:25.691+03	2026-11-06 11:33:21.937+02	2026-10-07 14:37:45.574+03	logout
5a48f70c-a3c4-41c5-a4b6-a8fdd26c50cb	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-07 15:02:27.247+03	2026-10-07 15:02:27.247+03	2026-11-06 14:02:27.246+02	2026-10-07 15:03:59.864+03	logout
0890175e-21fa-48ed-bb4d-89c98ce323c2	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-07 15:04:08.021+03	2026-10-07 15:04:08.021+03	2026-11-06 14:04:08.02+02	2026-10-07 15:04:51.547+03	logout
b0ba4b25-d8e7-4055-b261-bed930c7c3ca	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-07 15:14:14.029+03	2026-10-07 15:14:14.029+03	2026-11-06 14:14:14.028+02	2026-10-07 15:19:34.33+03	logout
382a5e00-4364-4b76-99fc-a323d0191e89	acdd78f6-9c1a-4ee8-9670-69422e336fad	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 14:22:16.954+03	2026-10-08 14:22:16.954+03	2026-11-07 13:22:16.953+02	2026-10-08 14:22:51.567+03	logout
9cf2d390-48ec-4053-939e-d6e9bac02794	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 14:19:57.532+03	2026-10-08 14:19:57.532+03	2026-11-07 13:19:57.531+02	2026-10-08 14:22:05.794+03	logout
144228e4-07d8-4c56-afde-50aa0ef6365f	24e598b1-ee10-457d-83bc-122a7e1ba398	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 14:23:02.343+03	2026-10-08 14:28:33.539+03	2026-11-07 13:23:02.342+02	2026-10-08 14:30:19.579+03	logout
73415f80-fc2e-4f79-be73-f8c7c9e346fe	acdd78f6-9c1a-4ee8-9670-69422e336fad	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 14:30:30.952+03	2026-10-08 14:30:30.952+03	2026-11-07 13:30:30.951+02	2026-10-08 14:30:45.457+03	logout
eeb2b4cf-9180-4d05-af66-2b8fc60a196d	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 14:30:53.453+03	2026-10-08 14:30:53.453+03	2026-11-07 13:30:53.452+02	2026-10-08 14:32:39.413+03	logout
44173165-5b9b-4423-ac19-3d94aeb50bf0	24e598b1-ee10-457d-83bc-122a7e1ba398	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 14:32:51.129+03	2026-10-08 14:32:51.129+03	2026-11-07 13:32:51.128+02	2026-10-08 14:37:38.182+03	logout
7745db1a-5cb3-407a-a848-40fc17822e26	24e598b1-ee10-457d-83bc-122a7e1ba398	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-12 11:56:38.477+03	2026-10-12 13:34:57.819+03	2026-11-11 10:56:38.472+02	\N	\N
6286ee12-aa18-4fd7-aef8-a440f2f2a6f3	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-12 00:29:32.708+03	2026-10-12 00:30:49.063+03	2026-11-10 23:29:32.706+02	2026-10-12 00:31:47.356+03	logout
b98aef35-85f0-463f-8d93-b9793df48f6c	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 15:35:48.735+03	2026-10-08 15:36:21.57+03	2026-11-07 14:35:48.734+02	2026-10-08 15:37:25.712+03	logout
c27b810f-714a-49a4-90a7-453e3ace96fb	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 15:37:34.541+03	2026-10-08 15:37:34.541+03	2026-11-07 14:37:34.539+02	2026-10-08 15:38:19.412+03	logout
261397ee-efbd-44d7-834e-1f90c758dbae	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 14:43:01.929+03	2026-10-08 14:56:28.971+03	2026-11-07 13:43:01.928+02	2026-10-08 14:56:58.644+03	logout
e56d9858-5f2a-4f21-a6bb-21fec4f42e7f	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 14:57:08.527+03	2026-10-08 14:57:08.527+03	2026-11-07 13:57:08.526+02	2026-10-08 14:58:43.978+03	logout
55acb8ef-3e91-416f-9673-5f638cb65a50	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 15:38:23.617+03	2026-10-08 15:38:23.617+03	2026-11-07 14:38:23.616+02	\N	\N
7b8f6547-434f-46e0-949c-047a71b4dc7e	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 14:59:01.544+03	2026-10-08 14:59:05.863+03	2026-11-07 13:59:01.542+02	2026-10-08 15:00:41.344+03	logout
2e728919-9b64-44ea-b96a-f729cf1ea89b	c420004f-c75c-4c25-947e-d9d0e6c3aa44	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 15:03:34.441+03	2026-10-08 15:11:23.856+03	2026-11-07 14:03:34.44+02	2026-10-08 15:11:37.225+03	logout
110dea84-f1b0-48c7-8301-b250e0fffa50	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 15:12:02.974+03	2026-10-08 15:12:02.974+03	2026-11-07 14:12:02.973+02	2026-10-08 15:15:40.64+03	logout
0068b910-638f-423e-847e-bc972f32b25f	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 17:35:31.808+03	2026-10-08 17:35:31.808+03	2026-11-07 16:35:31.807+02	2026-10-08 17:35:42.245+03	logout
7240508f-aa33-4b96-842e-b78e1eee1988	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 15:15:50.459+03	2026-10-08 15:27:59.22+03	2026-11-07 14:15:50.458+02	2026-10-08 15:32:23.546+03	logout
4a03db3b-73a9-435a-8d13-ce58a3d3e1ee	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 17:35:49.592+03	2026-10-08 17:35:49.592+03	2026-11-07 16:35:49.591+02	2026-10-08 17:38:40.919+03	logout
928d9638-6520-40e6-8d0b-94ddf26c8e20	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 15:32:48.393+03	2026-10-08 15:33:18.668+03	2026-11-07 14:32:48.392+02	2026-10-08 15:34:13.18+03	logout
df5c3edb-2655-4388-96ed-22afd34da72d	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 17:38:50.601+03	2026-10-08 17:39:36.687+03	2026-11-07 16:38:50.6+02	2026-10-08 17:40:08.505+03	logout
fc994aed-7116-45e7-8f9a-c82fb0176a25	acdd78f6-9c1a-4ee8-9670-69422e336fad	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-12 11:56:25.969+03	2026-10-12 11:56:25.969+03	2026-11-11 10:56:25.963+02	2026-10-12 11:56:26.054+03	logout
2947d374-9127-4878-be49-d39bdc36638e	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 15:34:20.689+03	2026-10-08 15:35:39.531+03	2026-11-07 14:34:20.683+02	\N	\N
077ea9ec-0a2d-4d59-983c-420eaa9327c4	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 17:40:14.751+03	2026-10-08 17:41:01.111+03	2026-11-07 16:40:14.749+02	2026-10-08 17:41:33.13+03	logout
4157eb17-8e53-4613-82ce-6c4e502628bd	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-08 17:41:44.242+03	2026-10-12 00:24:37.009+03	2026-11-07 16:41:44.241+02	2026-10-12 00:24:50.612+03	logout
25461f5f-312e-4eb3-8054-1e2519818bd4	acdd78f6-9c1a-4ee8-9670-69422e336fad	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-12 13:44:45.433+03	2026-10-12 13:44:45.433+03	2026-11-11 12:44:45.432+02	2026-10-12 13:44:45.509+03	logout
7ac38149-9944-4de3-894e-3a8f0a8cda12	24e598b1-ee10-457d-83bc-122a7e1ba398	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-12 00:25:01.253+03	2026-10-12 00:28:18.702+03	2026-11-10 23:25:01.252+02	2026-10-12 00:29:20.839+03	logout
f79eb197-e32e-43ee-8109-81ceac55e87e	acdd78f6-9c1a-4ee8-9670-69422e336fad	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-12 13:44:46.481+03	2026-10-12 13:44:46.481+03	2026-11-11 12:44:46.48+02	2026-10-12 13:44:46.51+03	logout
13ecb651-e694-42c1-a172-38f9f0d4c6d3	acdd78f6-9c1a-4ee8-9670-69422e336fad	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-12 13:45:20.37+03	2026-10-12 13:45:20.37+03	2026-11-11 12:45:20.369+02	2026-10-12 13:45:20.415+03	logout
6538a876-d86b-4a77-9021-3dca20e63734	acdd78f6-9c1a-4ee8-9670-69422e336fad	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-12 13:45:20.924+03	2026-10-12 13:45:20.924+03	2026-11-11 12:45:20.923+02	2026-10-12 13:45:20.949+03	logout
9a69d730-8085-407b-a1df-c34a6b08069a	acdd78f6-9c1a-4ee8-9670-69422e336fad	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-12 14:25:07.236+03	2026-10-12 14:25:07.236+03	2026-11-11 13:25:07.235+02	2026-10-12 14:25:07.299+03	logout
028084fe-24b4-43f8-8b84-493cb4f380e6	acdd78f6-9c1a-4ee8-9670-69422e336fad	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-12 14:25:38.464+03	2026-10-12 14:25:38.464+03	2026-11-11 13:25:38.463+02	2026-10-12 14:25:38.492+03	logout
51714ba5-3c4f-4538-a6ed-e00d5a455ca4	acdd78f6-9c1a-4ee8-9670-69422e336fad	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-12 14:25:08.117+03	2026-10-12 14:25:08.117+03	2026-11-11 13:25:08.116+02	2026-10-12 14:25:08.14+03	logout
929bd570-5f2a-48d2-9d50-70b0ea89e425	c420004f-c75c-4c25-947e-d9d0e6c3aa44	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-12 15:05:13.785+03	2026-10-12 15:05:13.785+03	2026-11-11 14:05:13.784+02	2026-10-12 15:15:27.446+03	logout
4d283b71-2922-41a4-9ca2-7fc06b46cc21	24e598b1-ee10-457d-83bc-122a7e1ba398	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-12 14:25:49.685+03	2026-10-12 14:34:01.032+03	2026-11-11 13:25:49.685+02	2026-10-12 14:34:09.456+03	logout
2dcb2be6-5d43-47f4-835c-e7fd3cd6f377	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-12 15:15:40.024+03	2026-10-12 15:15:40.024+03	2026-11-11 14:15:40.023+02	2026-10-12 15:16:14.831+03	logout
2ebd2973-a219-483b-a9b7-5e58de1bc9d5	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-12 14:35:05.739+03	2026-10-12 15:04:32.647+03	2026-11-11 13:35:05.737+02	2026-10-12 15:04:51.402+03	logout
0d0e665f-6767-4a1e-a55b-5f271cfa7c11	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9444	::1	2026-10-12 15:19:49.715+03	2026-10-12 15:19:49.715+03	2026-11-11 14:19:49.714+02	\N	\N
d0f152f9-2773-4e0e-98e6-81cabcb65cdb	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9444	::1	2026-10-12 15:19:58.033+03	2026-10-12 15:19:58.033+03	2026-11-11 14:19:58.032+02	\N	\N
d5f14cbb-ed0e-462f-9bec-aea0126ccda2	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9444	::1	2026-10-12 15:20:15.327+03	2026-10-12 15:20:15.327+03	2026-11-11 14:20:15.326+02	\N	\N
8613478c-983c-4924-b10c-86ab081dc6de	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9444	::1	2026-10-12 15:21:48.11+03	2026-10-12 15:21:48.11+03	2026-11-11 14:21:48.109+02	\N	\N
81d87c15-4543-493a-9f0a-094601b20710	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9444	::1	2026-10-12 15:28:33.628+03	2026-10-12 15:28:33.628+03	2026-11-11 14:28:33.627+02	\N	\N
e2aec66d-10b5-4536-82c1-9c733a145f42	96fd724b-f1c4-40f4-a29d-c1fb5dbbd750	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 15:34:00.591+03	2026-10-13 15:34:00.591+03	2026-11-12 14:34:00.59+02	2026-10-13 15:34:42.479+03	logout
0466dd10-9947-4c44-b2ec-8dd5ba0756cf	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36 Edg/155.0.0.0	::1	2026-10-12 17:25:11.017+03	2026-10-12 17:25:11.017+03	2026-11-11 16:25:11.012+02	\N	\N
55c1c20c-a1c0-4c15-8e7c-c7da588298be	24e598b1-ee10-457d-83bc-122a7e1ba398	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 14:48:26.914+03	2026-10-13 14:50:00.412+03	2026-11-12 13:48:26.913+02	2026-10-13 15:01:00.912+03	logout
ac0b21be-fb1e-4a13-8587-ce33cdd42843	24e598b1-ee10-457d-83bc-122a7e1ba398	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-12 15:16:23.067+03	2026-10-12 15:30:08.148+03	2026-11-11 14:16:23.066+02	2026-10-12 15:30:53.062+03	logout
297f24e5-1de9-4d54-a802-5b5df75575e9	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-12 15:31:08.279+03	2026-10-12 15:31:08.279+03	2026-11-11 14:31:08.277+02	2026-10-12 15:35:46.746+03	logout
892bd3b4-93f0-4502-a222-d88f8308d0ad	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9444	::1	2026-10-12 15:39:19.419+03	2026-10-12 15:39:19.419+03	2026-11-11 14:39:19.418+02	\N	\N
46414bc7-c857-4480-be24-2efe5faf11d6	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9444	::1	2026-10-12 15:39:30.776+03	2026-10-12 15:39:30.776+03	2026-11-11 14:39:30.775+02	\N	\N
5560a253-f710-4e10-81d6-e84e49f024b6	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9444	::1	2026-10-12 15:40:01.823+03	2026-10-12 15:40:01.823+03	2026-11-11 14:40:01.822+02	\N	\N
4ad34046-c1f7-4827-8d89-ff3593fefa63	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9444	::1	2026-10-12 15:40:13.279+03	2026-10-12 15:40:13.279+03	2026-11-11 14:40:13.278+02	\N	\N
47051f1f-e2e5-435f-a194-d8ef90906c87	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9444	::1	2026-10-12 15:40:23.169+03	2026-10-12 15:40:23.169+03	2026-11-11 14:40:23.168+02	\N	\N
f84d597a-4797-4103-9b7f-4e44801eb5c8	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT; Windows NT 10.0; en-US) WindowsPowerShell/5.1.26100.9444	::1	2026-10-12 15:40:34.34+03	2026-10-12 15:40:34.34+03	2026-11-11 14:40:34.339+02	\N	\N
822e3883-3ba4-4a5f-a831-1d8a9dac25a5	c420004f-c75c-4c25-947e-d9d0e6c3aa44	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-12 16:30:19.192+03	2026-10-13 14:31:18.859+03	2026-11-11 15:30:19.191+02	2026-10-13 14:31:20.876+03	logout
53ce01fb-dae5-465a-961c-7abfc1d4994c	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-12 16:01:02.26+03	2026-10-12 16:30:04.823+03	2026-11-11 15:01:02.259+02	2026-10-12 16:30:04.855+03	logout
da72f9a0-2f03-4bec-a3e9-b5c45e270ba4	acdd78f6-9c1a-4ee8-9670-69422e336fad	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-12 16:30:11.168+03	2026-10-12 16:30:11.168+03	2026-11-11 15:30:11.166+02	2026-10-12 16:30:11.2+03	logout
bb507bee-f76d-4b6a-8fa2-89dd6696438e	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 14:31:36.425+03	2026-10-13 14:31:36.425+03	2026-11-12 13:31:36.423+02	2026-10-13 14:33:16.005+03	logout
dc51b01c-6514-4d84-b8d3-c1c07eb4f8a4	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 15:01:14.892+03	2026-10-13 15:01:14.892+03	2026-11-12 14:01:14.891+02	2026-10-13 15:03:18.616+03	logout
7e60fa77-c1d8-4204-b158-1c31dd1f6ad5	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 17:13:33.058+03	2026-10-13 17:13:33.058+03	2026-11-12 16:13:33.056+02	2026-10-13 17:13:45.677+03	logout
a7aa14e1-eeb8-4cd2-be06-7b71074914e7	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 15:03:39.834+03	2026-10-13 15:22:25.132+03	2026-11-12 14:03:39.833+02	2026-10-13 15:22:25.17+03	logout
3dadfff0-df8d-46b6-aa9e-a49ebce008b8	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 15:22:34.063+03	2026-10-13 15:23:59.844+03	2026-11-12 14:22:34.055+02	2026-10-13 15:24:18.081+03	logout
0c527439-5ef1-4fe4-996d-3acebdf4daa6	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 15:25:20.197+03	2026-10-13 15:25:20.197+03	2026-11-12 14:25:20.195+02	2026-10-13 15:28:07.734+03	logout
d399af64-3411-4bed-a235-f1471b23f59f	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 15:28:17.055+03	2026-10-13 15:28:17.055+03	2026-11-12 14:28:17.053+02	2026-10-13 15:28:17.077+03	logout
63fc48b8-c187-4557-ab52-52729bc16cd7	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 14:33:26.51+03	2026-10-13 14:46:55.11+03	2026-11-12 13:33:26.509+02	2026-10-13 14:47:45.534+03	logout
cb9140e7-ab26-4f9d-a395-ae4b6fcf2f7b	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 14:47:55.061+03	2026-10-13 14:47:55.061+03	2026-11-12 13:47:55.06+02	2026-10-13 14:48:21.597+03	logout
fdaf3074-a268-45fa-8845-32389d5a485d	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 15:28:32.938+03	2026-10-13 15:28:32.938+03	2026-11-12 14:28:32.936+02	2026-10-13 15:33:48.889+03	logout
07492bf3-86cb-4e0e-bda1-98a29452b43e	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 15:37:38.303+03	2026-10-13 15:57:21.935+03	2026-11-12 14:37:38.302+02	2026-10-13 15:58:10.722+03	logout
f463fcfd-a06f-441c-ba95-5ddb54fca08a	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 15:58:32.17+03	2026-10-13 15:58:32.17+03	2026-11-12 14:58:32.169+02	2026-10-13 16:00:32.079+03	logout
c863caa2-e6fa-4f69-a685-d0616cd49627	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 16:00:38.528+03	2026-10-13 16:00:38.528+03	2026-11-12 15:00:38.527+02	2026-10-13 16:01:17.553+03	logout
da314fa6-ff9d-4566-b28d-4a52fd3f623a	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 16:01:23.616+03	2026-10-13 16:01:23.616+03	2026-11-12 15:01:23.615+02	2026-10-13 16:01:32.619+03	logout
8f02dca5-df33-4769-a56c-0215c448d0e4	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 17:26:59.351+03	2026-10-13 18:49:21.284+03	2026-11-12 16:26:59.35+02	2026-10-13 18:49:42.308+03	logout
7ecd2c5d-ff55-46d2-a11c-b4888b8bec69	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 17:13:58.887+03	2026-10-13 17:26:50.101+03	2026-11-12 16:13:58.886+02	2026-10-13 17:26:52.412+03	logout
00124014-1211-4086-aa3e-28773f69839d	e01abc5f-5343-4078-a4e0-2fdec3ee013d	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 19:18:35.296+03	2026-10-13 19:18:35.296+03	2026-11-12 18:18:35.295+02	2026-10-13 19:20:21.318+03	logout
0fe136c8-9d3e-4e8a-a66b-5edcf51934a2	c420004f-c75c-4c25-947e-d9d0e6c3aa44	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 18:50:35.599+03	2026-10-13 19:16:20.433+03	2026-11-12 17:50:35.598+02	2026-10-13 19:18:19.344+03	logout
da4b17da-124d-4115-b6b2-1674b3a371ac	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 18:49:49.184+03	2026-10-13 18:50:29.381+03	2026-11-12 17:49:49.183+02	2026-10-13 18:50:31.191+03	logout
61fd5e42-7e70-4b30-94b3-4b890e6662d1	c420004f-c75c-4c25-947e-d9d0e6c3aa44	Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/155.0.0.0 Safari/537.36	::1	2026-10-13 19:20:34.239+03	2026-10-13 19:30:56.292+03	2026-11-12 18:20:34.238+02	\N	\N
\.


--
-- Data for Name: system_settings; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.system_settings (id, key, value, category, is_public, description, updated_at) FROM stdin;
d2386b8c-d4bc-47f2-9886-24acb06e84b9	seat_hold_minutes	15	booking	t	Minutes a seat hold stays active during checkout	2026-09-30 12:51:13.632+03
a290d7d0-acbe-4970-999b-4d5d81db108b	check_in_opens_hours	24	operations	t	Hours before departure when online check-in opens	2026-09-30 12:51:13.645+03
560da6ea-d773-4eb8-a550-7bb3af55b1ce	default_currency	EUR	localization	t	Default currency for new bookings	2026-09-30 12:51:13.647+03
db391ba8-3072-4f93-970f-0c8b12d7b23a	cancellation_fee_percent	10	finance	f	Default cancellation fee percentage	2026-09-30 12:51:13.649+03
\.


--
-- Data for Name: user_roles; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.user_roles (id, user_id, role_id) FROM stdin;
03900f58-098f-4767-be4b-537fd79be944	9fd0f96e-5cbb-4857-87f8-66c1cafb2ceb	6dad78ee-b631-4616-9db0-c6abfb40b603
7c93a88b-1117-457d-8750-ed1a3860ae26	5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	6dad78ee-b631-4616-9db0-c6abfb40b603
241a62b6-baa0-4e90-b6b9-39ab052348a4	e01abc5f-5343-4078-a4e0-2fdec3ee013d	3b7e8868-4ad2-4e25-b942-98f6b9bdde85
7ca7e841-0ffc-4dde-9f68-b57df97a1996	34eedc56-29ef-4665-87fa-648c6a23dc72	6dad78ee-b631-4616-9db0-c6abfb40b603
2028f7fd-7e10-4891-978d-d0f1fa9f416a	07f79e6f-4ec3-470b-9058-4e793dc97d7e	6dad78ee-b631-4616-9db0-c6abfb40b603
3a5d0846-9a99-4830-b39e-d75730e87e6e	24e598b1-ee10-457d-83bc-122a7e1ba398	6dad78ee-b631-4616-9db0-c6abfb40b603
dcb316b3-d40c-46d9-a409-655762714923	acdd78f6-9c1a-4ee8-9670-69422e336fad	43f19c03-b120-4383-8dec-572c8f50039a
39de6b93-d95a-48da-8fac-70bb3f491d3a	c420004f-c75c-4c25-947e-d9d0e6c3aa44	6dad78ee-b631-4616-9db0-c6abfb40b603
2fdb1430-3c94-43d8-8284-0d9cb0b77f22	96fd724b-f1c4-40f4-a29d-c1fb5dbbd750	6b0d0393-3abb-41fd-bd16-da2875be84a2
\.


--
-- Data for Name: users; Type: TABLE DATA; Schema: public; Owner: airline
--

COPY public.users (id, email, password_hash, first_name, last_name, phone, email_verified, mfa_secret, mfa_enabled, mfa_backup_codes, status, created_at, updated_at, date_of_birth) FROM stdin;
9fd0f96e-5cbb-4857-87f8-66c1cafb2ceb	customer@test.com	$argon2id$v=19$m=19456,t=2,p=1$PELmBV6U5oJAhL641ZrcHA$iGJRJlve1nmmzAISlu1hhKIhy+G70ylMaehgx+c8HFw	Test	Customer	\N	t	\N	f	\N	ACTIVE	2026-09-30 11:58:48.463+03	2026-09-30 11:58:48.497+03	\N
5a2b69c1-e38b-42ec-8db1-9c46c4d5abd0	ciyohi2912@aminavin.com	$argon2id$v=19$m=19456,t=2,p=1$/FHFZ15D7r8Utm4nscQvFQ$tbz4ypJfJxNlAgATKqHlXBGbR3ng/lURARDfuZJgzTA	Amir	Hanna	\N	t	IRQVAKD2LBJW242JIFGUOPSUNM5TIQLBHFEW4KKLMVEXWPZ2MFFQ	f	\N	ACTIVE	2026-09-30 12:18:58.558+03	2026-09-30 12:21:10.982+03	\N
e01abc5f-5343-4078-a4e0-2fdec3ee013d	admin@airline.local	$argon2id$v=19$m=19456,t=2,p=1$XujCujQfZMlT3A5SLK2c8w$gVxX4vS4P/vOw6Et4vW9FQn5FhnlT5LylzfWo6cuxvY	System	Administrator	\N	t	\N	f	\N	ACTIVE	2026-09-30 12:51:12.071+03	2026-09-30 12:51:12.071+03	\N
34eedc56-29ef-4665-87fa-648c6a23dc72	customer@example.com	$argon2id$v=19$m=19456,t=2,p=1$emkxFY9G90Ok8iZ1iyHBIw$kwYv2/D7GJ7NrsNSvcggl9CwR0lB7opGfozBautEF0A	Demo	Customer	\N	t	\N	f	\N	ACTIVE	2026-09-30 12:51:12.097+03	2026-09-30 12:51:12.097+03	\N
07f79e6f-4ec3-470b-9058-4e793dc97d7e	e2e-1791294137@novaair.dev	$argon2id$v=19$m=19456,t=2,p=1$U702irP2YVHlZRYGMMC+YQ$UHto5JPyyylxTYH7XT2rCOuMS4zV93Xwptwj2iNXKIU	E2E	Verifier	\N	f	\N	f	\N	PENDING_VERIFICATION	2026-10-06 16:42:17.669+03	2026-10-06 16:42:17.669+03	1990-01-15
24e598b1-ee10-457d-83bc-122a7e1ba398	mosin99141@aahzz.com	$argon2id$v=19$m=19456,t=2,p=1$w2y9MFlAkmTMGoskuZ6kxQ$RND0qalGR0z9bgWbE/rjaWMTLjG307bAPsonajikFwM	Ahmed	shaban	\N	t	\N	f	\N	ACTIVE	2026-10-07 15:06:15.795+03	2026-10-07 15:06:46.339+03	2000-08-08
acdd78f6-9c1a-4ee8-9670-69422e336fad	siselab184@18lover.com	$argon2id$v=19$m=19456,t=2,p=1$ajyZmsFxpC2txFzSJPkooQ$lAUSkDMdzjh0ODlW/slImdhfTlBZhP4PIHAJ2NdH3tg	Bor3y	Ahmed	\N	f	\N	f	\N	ACTIVE	2026-10-08 14:22:01.337+03	2026-10-08 14:22:01.337+03	\N
c420004f-c75c-4c25-947e-d9d0e6c3aa44	vapajey727@aahzz.com	$argon2id$v=19$m=19456,t=2,p=1$KZzJh97oV/+fJYYP92eheQ$8gvibTickThOsK7OZFM2QgWFs2wq5CRdDTQMZaLaw7o	Baher	Ayman	\N	t	\N	f	\N	ACTIVE	2026-10-08 15:02:25.761+03	2026-10-08 15:02:54.312+03	2000-10-01
96fd724b-f1c4-40f4-a29d-c1fb5dbbd750	xorev53440@18lover.com	$argon2id$v=19$m=19456,t=2,p=1$DYcT1GyVa2a1ojtltN0oSw$I4topU0cMJWkxrhkd7D/n5T2q4aHDWYF7yqc87pMpak	medo	Finance	\N	f	\N	f	\N	ACTIVE	2026-10-13 15:33:44.991+03	2026-10-13 15:33:44.991+03	\N
\.


--
-- Name: _prisma_migrations _prisma_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public._prisma_migrations
    ADD CONSTRAINT _prisma_migrations_pkey PRIMARY KEY (id);


--
-- Name: aircraft aircraft_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.aircraft
    ADD CONSTRAINT aircraft_pkey PRIMARY KEY (id);


--
-- Name: airports airports_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.airports
    ADD CONSTRAINT airports_pkey PRIMARY KEY (id);


--
-- Name: audit_logs audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_pkey PRIMARY KEY (id);


--
-- Name: baggage_events baggage_events_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.baggage_events
    ADD CONSTRAINT baggage_events_pkey PRIMARY KEY (id);


--
-- Name: baggage baggage_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.baggage
    ADD CONSTRAINT baggage_pkey PRIMARY KEY (id);


--
-- Name: boarding_passes boarding_passes_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.boarding_passes
    ADD CONSTRAINT boarding_passes_pkey PRIMARY KEY (id);


--
-- Name: booking_extras booking_extras_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.booking_extras
    ADD CONSTRAINT booking_extras_pkey PRIMARY KEY (id);


--
-- Name: booking_passengers booking_passengers_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.booking_passengers
    ADD CONSTRAINT booking_passengers_pkey PRIMARY KEY (id);


--
-- Name: booking_seats booking_seats_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.booking_seats
    ADD CONSTRAINT booking_seats_pkey PRIMARY KEY (id);


--
-- Name: bookings bookings_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_pkey PRIMARY KEY (id);


--
-- Name: cancellation_requests cancellation_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.cancellation_requests
    ADD CONSTRAINT cancellation_requests_pkey PRIMARY KEY (id);


--
-- Name: check_ins check_ins_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.check_ins
    ADD CONSTRAINT check_ins_pkey PRIMARY KEY (id);


--
-- Name: email_verification_tokens email_verification_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_pkey PRIMARY KEY (id);


--
-- Name: extra_services extra_services_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.extra_services
    ADD CONSTRAINT extra_services_pkey PRIMARY KEY (id);


--
-- Name: fares fares_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.fares
    ADD CONSTRAINT fares_pkey PRIMARY KEY (id);


--
-- Name: flight_segments flight_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.flight_segments
    ADD CONSTRAINT flight_segments_pkey PRIMARY KEY (id);


--
-- Name: flights flights_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.flights
    ADD CONSTRAINT flights_pkey PRIMARY KEY (id);


--
-- Name: loyalty_accounts loyalty_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.loyalty_accounts
    ADD CONSTRAINT loyalty_accounts_pkey PRIMARY KEY (id);


--
-- Name: loyalty_transactions loyalty_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_pkey PRIMARY KEY (id);


--
-- Name: notification_templates notification_templates_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.notification_templates
    ADD CONSTRAINT notification_templates_pkey PRIMARY KEY (id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: offers offers_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_pkey PRIMARY KEY (id);


--
-- Name: orphan_provider_refunds orphan_provider_refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.orphan_provider_refunds
    ADD CONSTRAINT orphan_provider_refunds_pkey PRIMARY KEY (id);


--
-- Name: passengers passengers_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.passengers
    ADD CONSTRAINT passengers_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: payment_webhook_events payment_webhook_events_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.payment_webhook_events
    ADD CONSTRAINT payment_webhook_events_pkey PRIMARY KEY (id);


--
-- Name: payments payments_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: refunds refunds_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_pkey PRIMARY KEY (id);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: routes routes_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_pkey PRIMARY KEY (id);


--
-- Name: schedule_rules schedule_rules_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.schedule_rules
    ADD CONSTRAINT schedule_rules_pkey PRIMARY KEY (id);


--
-- Name: seat_holds seat_holds_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.seat_holds
    ADD CONSTRAINT seat_holds_pkey PRIMARY KEY (id);


--
-- Name: seats seats_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.seats
    ADD CONSTRAINT seats_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: system_settings system_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.system_settings
    ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: aircraft_registration_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX aircraft_registration_key ON public.aircraft USING btree (registration);


--
-- Name: airports_iata_code_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX airports_iata_code_key ON public.airports USING btree (iata_code);


--
-- Name: audit_logs_action_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX audit_logs_action_idx ON public.audit_logs USING btree (action);


--
-- Name: audit_logs_actor_id_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX audit_logs_actor_id_idx ON public.audit_logs USING btree (actor_id);


--
-- Name: audit_logs_actor_type_action_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX audit_logs_actor_type_action_idx ON public.audit_logs USING btree (actor_type, action);


--
-- Name: audit_logs_created_at_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX audit_logs_created_at_idx ON public.audit_logs USING btree (created_at);


--
-- Name: audit_logs_target_type_target_id_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX audit_logs_target_type_target_id_idx ON public.audit_logs USING btree (target_type, target_id);


--
-- Name: baggage_events_baggage_id_occurred_at_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX baggage_events_baggage_id_occurred_at_idx ON public.baggage_events USING btree (baggage_id, occurred_at);


--
-- Name: baggage_tag_number_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX baggage_tag_number_key ON public.baggage USING btree (tag_number);


--
-- Name: boarding_passes_check_in_id_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX boarding_passes_check_in_id_key ON public.boarding_passes USING btree (check_in_id);


--
-- Name: booking_passengers_booking_id_passenger_id_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX booking_passengers_booking_id_passenger_id_key ON public.booking_passengers USING btree (booking_id, passenger_id);


--
-- Name: booking_seats_booking_passenger_id_flight_segment_id_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX booking_seats_booking_passenger_id_flight_segment_id_key ON public.booking_seats USING btree (booking_passenger_id, flight_segment_id);


--
-- Name: booking_seats_flight_segment_id_seat_id_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX booking_seats_flight_segment_id_seat_id_key ON public.booking_seats USING btree (flight_segment_id, seat_id);


--
-- Name: bookings_booking_reference_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX bookings_booking_reference_key ON public.bookings USING btree (booking_reference);


--
-- Name: bookings_offer_id_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX bookings_offer_id_idx ON public.bookings USING btree (offer_id);


--
-- Name: bookings_user_id_booked_at_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX bookings_user_id_booked_at_idx ON public.bookings USING btree (user_id, booked_at);


--
-- Name: bookings_user_id_idempotency_key_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX bookings_user_id_idempotency_key_key ON public.bookings USING btree (user_id, idempotency_key);


--
-- Name: cancellation_requests_booking_id_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX cancellation_requests_booking_id_idx ON public.cancellation_requests USING btree (booking_id);


--
-- Name: cancellation_requests_one_pending_per_booking; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX cancellation_requests_one_pending_per_booking ON public.cancellation_requests USING btree (booking_id) WHERE (status = 'PENDING'::public.cancellation_request_status);


--
-- Name: cancellation_requests_status_requested_at_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX cancellation_requests_status_requested_at_idx ON public.cancellation_requests USING btree (status, requested_at);


--
-- Name: check_ins_booking_passenger_id_flight_segment_id_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX check_ins_booking_passenger_id_flight_segment_id_key ON public.check_ins USING btree (booking_passenger_id, flight_segment_id);


--
-- Name: email_verification_tokens_token_hash_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX email_verification_tokens_token_hash_key ON public.email_verification_tokens USING btree (token_hash);


--
-- Name: email_verification_tokens_user_id_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX email_verification_tokens_user_id_idx ON public.email_verification_tokens USING btree (user_id);


--
-- Name: extra_services_code_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX extra_services_code_key ON public.extra_services USING btree (code);


--
-- Name: fares_flight_id_cabin_class_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX fares_flight_id_cabin_class_key ON public.fares USING btree (flight_id, cabin_class);


--
-- Name: flight_segments_flight_id_segment_number_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX flight_segments_flight_id_segment_number_key ON public.flight_segments USING btree (flight_id, segment_number);


--
-- Name: flights_departure_time_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX flights_departure_time_idx ON public.flights USING btree (departure_time);


--
-- Name: flights_operating_date_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX flights_operating_date_idx ON public.flights USING btree (operating_date);


--
-- Name: flights_schedule_rule_id_operating_date_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX flights_schedule_rule_id_operating_date_key ON public.flights USING btree (schedule_rule_id, operating_date);


--
-- Name: flights_status_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX flights_status_idx ON public.flights USING btree (status);


--
-- Name: loyalty_accounts_member_number_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX loyalty_accounts_member_number_key ON public.loyalty_accounts USING btree (member_number);


--
-- Name: loyalty_accounts_user_id_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX loyalty_accounts_user_id_key ON public.loyalty_accounts USING btree (user_id);


--
-- Name: notification_templates_code_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX notification_templates_code_key ON public.notification_templates USING btree (code);


--
-- Name: notifications_booking_id_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX notifications_booking_id_idx ON public.notifications USING btree (booking_id);


--
-- Name: notifications_user_id_status_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX notifications_user_id_status_idx ON public.notifications USING btree (user_id, status);


--
-- Name: offers_status_valid_from_valid_until_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX offers_status_valid_from_valid_until_idx ON public.offers USING btree (status, valid_from, valid_until);


--
-- Name: offers_title_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX offers_title_key ON public.offers USING btree (title);


--
-- Name: orphan_provider_refunds_provider_provider_refund_reference_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX orphan_provider_refunds_provider_provider_refund_reference_key ON public.orphan_provider_refunds USING btree (provider, provider_refund_reference);


--
-- Name: orphan_provider_refunds_status_first_seen_at_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX orphan_provider_refunds_status_first_seen_at_idx ON public.orphan_provider_refunds USING btree (status, first_seen_at);


--
-- Name: password_reset_tokens_token_hash_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX password_reset_tokens_token_hash_key ON public.password_reset_tokens USING btree (token_hash);


--
-- Name: password_reset_tokens_user_id_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX password_reset_tokens_user_id_idx ON public.password_reset_tokens USING btree (user_id);


--
-- Name: payment_webhook_events_provider_event_id_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX payment_webhook_events_provider_event_id_key ON public.payment_webhook_events USING btree (provider, event_id);


--
-- Name: payments_booking_id_idempotency_key_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX payments_booking_id_idempotency_key_key ON public.payments USING btree (booking_id, idempotency_key);


--
-- Name: payments_booking_id_status_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX payments_booking_id_status_idx ON public.payments USING btree (booking_id, status);


--
-- Name: payments_provider_reference_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX payments_provider_reference_key ON public.payments USING btree (provider_reference);


--
-- Name: permissions_resource_action_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX permissions_resource_action_key ON public.permissions USING btree (resource, action);


--
-- Name: refresh_tokens_session_id_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX refresh_tokens_session_id_idx ON public.refresh_tokens USING btree (session_id);


--
-- Name: refresh_tokens_token_hash_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX refresh_tokens_token_hash_key ON public.refresh_tokens USING btree (token_hash);


--
-- Name: refunds_booking_id_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX refunds_booking_id_idx ON public.refunds USING btree (booking_id);


--
-- Name: refunds_payment_id_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX refunds_payment_id_idx ON public.refunds USING btree (payment_id);


--
-- Name: refunds_status_created_at_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX refunds_status_created_at_idx ON public.refunds USING btree (status, created_at);


--
-- Name: role_permissions_role_id_permission_id_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX role_permissions_role_id_permission_id_key ON public.role_permissions USING btree (role_id, permission_id);


--
-- Name: roles_name_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX roles_name_key ON public.roles USING btree (name);


--
-- Name: routes_origin_airport_id_destination_airport_id_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX routes_origin_airport_id_destination_airport_id_key ON public.routes USING btree (origin_airport_id, destination_airport_id);


--
-- Name: schedule_rules_flight_number_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX schedule_rules_flight_number_key ON public.schedule_rules USING btree (flight_number);


--
-- Name: seat_holds_booking_id_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX seat_holds_booking_id_idx ON public.seat_holds USING btree (booking_id);


--
-- Name: seat_holds_flight_id_seat_id_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX seat_holds_flight_id_seat_id_idx ON public.seat_holds USING btree (flight_id, seat_id);


--
-- Name: seat_holds_one_active_per_flight_seat; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX seat_holds_one_active_per_flight_seat ON public.seat_holds USING btree (flight_id, seat_id) WHERE (status = 'ACTIVE'::public.seat_hold_status);


--
-- Name: seat_holds_status_expires_at_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX seat_holds_status_expires_at_idx ON public.seat_holds USING btree (status, expires_at);


--
-- Name: seats_aircraft_id_seat_number_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX seats_aircraft_id_seat_number_key ON public.seats USING btree (aircraft_id, seat_number);


--
-- Name: sessions_expires_at_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX sessions_expires_at_idx ON public.sessions USING btree (expires_at);


--
-- Name: sessions_user_id_idx; Type: INDEX; Schema: public; Owner: airline
--

CREATE INDEX sessions_user_id_idx ON public.sessions USING btree (user_id);


--
-- Name: system_settings_key_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX system_settings_key_key ON public.system_settings USING btree (key);


--
-- Name: user_roles_user_id_role_id_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX user_roles_user_id_role_id_key ON public.user_roles USING btree (user_id, role_id);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: airline
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (email);


--
-- Name: audit_logs audit_logs_actor_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_actor_id_fkey FOREIGN KEY (actor_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: audit_logs audit_logs_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.audit_logs
    ADD CONSTRAINT audit_logs_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: baggage baggage_booking_passenger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.baggage
    ADD CONSTRAINT baggage_booking_passenger_id_fkey FOREIGN KEY (booking_passenger_id) REFERENCES public.booking_passengers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: baggage_events baggage_events_baggage_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.baggage_events
    ADD CONSTRAINT baggage_events_baggage_id_fkey FOREIGN KEY (baggage_id) REFERENCES public.baggage(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: boarding_passes boarding_passes_check_in_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.boarding_passes
    ADD CONSTRAINT boarding_passes_check_in_id_fkey FOREIGN KEY (check_in_id) REFERENCES public.check_ins(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: booking_extras booking_extras_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.booking_extras
    ADD CONSTRAINT booking_extras_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: booking_extras booking_extras_extra_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.booking_extras
    ADD CONSTRAINT booking_extras_extra_service_id_fkey FOREIGN KEY (extra_service_id) REFERENCES public.extra_services(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: booking_passengers booking_passengers_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.booking_passengers
    ADD CONSTRAINT booking_passengers_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: booking_passengers booking_passengers_passenger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.booking_passengers
    ADD CONSTRAINT booking_passengers_passenger_id_fkey FOREIGN KEY (passenger_id) REFERENCES public.passengers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: booking_seats booking_seats_booking_passenger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.booking_seats
    ADD CONSTRAINT booking_seats_booking_passenger_id_fkey FOREIGN KEY (booking_passenger_id) REFERENCES public.booking_passengers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: booking_seats booking_seats_flight_segment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.booking_seats
    ADD CONSTRAINT booking_seats_flight_segment_id_fkey FOREIGN KEY (flight_segment_id) REFERENCES public.flight_segments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: booking_seats booking_seats_seat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.booking_seats
    ADD CONSTRAINT booking_seats_seat_id_fkey FOREIGN KEY (seat_id) REFERENCES public.seats(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bookings bookings_offer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_offer_id_fkey FOREIGN KEY (offer_id) REFERENCES public.offers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bookings bookings_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.bookings
    ADD CONSTRAINT bookings_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cancellation_requests cancellation_requests_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.cancellation_requests
    ADD CONSTRAINT cancellation_requests_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: cancellation_requests cancellation_requests_refund_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.cancellation_requests
    ADD CONSTRAINT cancellation_requests_refund_id_fkey FOREIGN KEY (refund_id) REFERENCES public.refunds(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: cancellation_requests cancellation_requests_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.cancellation_requests
    ADD CONSTRAINT cancellation_requests_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: check_ins check_ins_booking_passenger_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.check_ins
    ADD CONSTRAINT check_ins_booking_passenger_id_fkey FOREIGN KEY (booking_passenger_id) REFERENCES public.booking_passengers(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: check_ins check_ins_flight_segment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.check_ins
    ADD CONSTRAINT check_ins_flight_segment_id_fkey FOREIGN KEY (flight_segment_id) REFERENCES public.flight_segments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: email_verification_tokens email_verification_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.email_verification_tokens
    ADD CONSTRAINT email_verification_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: fares fares_flight_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.fares
    ADD CONSTRAINT fares_flight_id_fkey FOREIGN KEY (flight_id) REFERENCES public.flights(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: flight_segments flight_segments_destination_airport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.flight_segments
    ADD CONSTRAINT flight_segments_destination_airport_id_fkey FOREIGN KEY (destination_airport_id) REFERENCES public.airports(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: flight_segments flight_segments_flight_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.flight_segments
    ADD CONSTRAINT flight_segments_flight_id_fkey FOREIGN KEY (flight_id) REFERENCES public.flights(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: flight_segments flight_segments_origin_airport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.flight_segments
    ADD CONSTRAINT flight_segments_origin_airport_id_fkey FOREIGN KEY (origin_airport_id) REFERENCES public.airports(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: flights flights_aircraft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.flights
    ADD CONSTRAINT flights_aircraft_id_fkey FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: flights flights_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.flights
    ADD CONSTRAINT flights_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: flights flights_schedule_rule_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.flights
    ADD CONSTRAINT flights_schedule_rule_id_fkey FOREIGN KEY (schedule_rule_id) REFERENCES public.schedule_rules(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: loyalty_accounts loyalty_accounts_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.loyalty_accounts
    ADD CONSTRAINT loyalty_accounts_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: loyalty_transactions loyalty_transactions_loyalty_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.loyalty_transactions
    ADD CONSTRAINT loyalty_transactions_loyalty_account_id_fkey FOREIGN KEY (loyalty_account_id) REFERENCES public.loyalty_accounts(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: notifications notifications_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notifications notifications_template_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_template_id_fkey FOREIGN KEY (template_id) REFERENCES public.notification_templates(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: offers offers_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.offers
    ADD CONSTRAINT offers_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: passengers passengers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.passengers
    ADD CONSTRAINT passengers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: payments payments_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.payments
    ADD CONSTRAINT payments_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: refresh_tokens refresh_tokens_session_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_session_id_fkey FOREIGN KEY (session_id) REFERENCES public.sessions(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: refunds refunds_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: refunds refunds_payment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.refunds
    ADD CONSTRAINT refunds_payment_id_fkey FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES public.permissions(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: routes routes_destination_airport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_destination_airport_id_fkey FOREIGN KEY (destination_airport_id) REFERENCES public.airports(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: routes routes_origin_airport_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.routes
    ADD CONSTRAINT routes_origin_airport_id_fkey FOREIGN KEY (origin_airport_id) REFERENCES public.airports(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: schedule_rules schedule_rules_aircraft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.schedule_rules
    ADD CONSTRAINT schedule_rules_aircraft_id_fkey FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: schedule_rules schedule_rules_route_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.schedule_rules
    ADD CONSTRAINT schedule_rules_route_id_fkey FOREIGN KEY (route_id) REFERENCES public.routes(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: seat_holds seat_holds_booking_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.seat_holds
    ADD CONSTRAINT seat_holds_booking_id_fkey FOREIGN KEY (booking_id) REFERENCES public.bookings(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: seat_holds seat_holds_flight_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.seat_holds
    ADD CONSTRAINT seat_holds_flight_id_fkey FOREIGN KEY (flight_id) REFERENCES public.flights(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: seat_holds seat_holds_seat_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.seat_holds
    ADD CONSTRAINT seat_holds_seat_id_fkey FOREIGN KEY (seat_id) REFERENCES public.seats(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: seat_holds seat_holds_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.seat_holds
    ADD CONSTRAINT seat_holds_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: seats seats_aircraft_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.seats
    ADD CONSTRAINT seats_aircraft_id_fkey FOREIGN KEY (aircraft_id) REFERENCES public.aircraft(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES public.roles(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: airline
--

ALTER TABLE ONLY public.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict KfddOq8CNpaZ1YudbUx7Xv7XK2FVGeAQ0ioQ2OHdFxPoWaWhp5UHyZJpmaoUkAH

