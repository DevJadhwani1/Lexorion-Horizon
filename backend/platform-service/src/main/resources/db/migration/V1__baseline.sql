--
-- PostgreSQL database dump
--



SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: entitlement_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.entitlement_definitions (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    description character varying(1000),
    display_name character varying(150) NOT NULL,
    entitlement_key character varying(150) NOT NULL,
    status character varying(20) NOT NULL,
    value_type character varying(20) NOT NULL,
    CONSTRAINT entitlement_definitions_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[]))),
    CONSTRAINT entitlement_definitions_value_type_check CHECK (((value_type)::text = ANY ((ARRAY['BOOLEAN'::character varying, 'INTEGER'::character varying])::text[])))
);


--
-- Name: organization_domains; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_domains (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    access_mode character varying(20) NOT NULL,
    active boolean NOT NULL,
    domain_type character varying(30) NOT NULL,
    hostname character varying(253) NOT NULL,
    primary_domain boolean NOT NULL,
    verification_status character varying(20) NOT NULL,
    verified_at timestamp(6) with time zone,
    organization_id uuid NOT NULL,
    CONSTRAINT organization_domains_access_mode_check CHECK (((access_mode)::text = ANY ((ARRAY['STANDARD'::character varying, 'WHITE_LABEL'::character varying])::text[]))),
    CONSTRAINT organization_domains_domain_type_check CHECK (((domain_type)::text = ANY ((ARRAY['PLATFORM_SUBDOMAIN'::character varying, 'CUSTOM_SUBDOMAIN'::character varying, 'CUSTOM_DOMAIN'::character varying])::text[]))),
    CONSTRAINT organization_domains_verification_status_check CHECK (((verification_status)::text = ANY ((ARRAY['PENDING'::character varying, 'VERIFIED'::character varying, 'FAILED'::character varying])::text[])))
);


--
-- Name: organization_invitations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_invitations (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    accepted_at timestamp(6) with time zone,
    expires_at timestamp(6) with time zone NOT NULL,
    intended_role character varying(20) NOT NULL,
    normalized_email character varying(255) NOT NULL,
    status character varying(20) NOT NULL,
    token_hash character varying(64) NOT NULL,
    invited_by uuid NOT NULL,
    organization_id uuid NOT NULL,
    CONSTRAINT organization_invitations_intended_role_check CHECK (((intended_role)::text = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying, 'MEMBER'::character varying])::text[]))),
    CONSTRAINT organization_invitations_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'ACCEPTED'::character varying, 'EXPIRED'::character varying, 'REVOKED'::character varying])::text[])))
);


--
-- Name: organization_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_memberships (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    joined_at timestamp(6) with time zone NOT NULL,
    role character varying(20) NOT NULL,
    status character varying(20) NOT NULL,
    organization_id uuid NOT NULL,
    user_id uuid NOT NULL,
    CONSTRAINT organization_memberships_role_check CHECK (((role)::text = ANY ((ARRAY['OWNER'::character varying, 'ADMIN'::character varying, 'MANAGER'::character varying, 'MEMBER'::character varying])::text[]))),
    CONSTRAINT organization_memberships_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'SUSPENDED'::character varying])::text[])))
);


--
-- Name: organization_plan_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_plan_assignments (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    status character varying(20) NOT NULL,
    organization_id uuid NOT NULL,
    plan_id uuid NOT NULL,
    product_id uuid NOT NULL,
    CONSTRAINT organization_plan_assignments_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))
);


--
-- Name: organization_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_settings (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    branding_display_name character varying(150),
    default_country character varying(2) NOT NULL,
    default_currency character varying(3) NOT NULL,
    locale character varying(35) NOT NULL,
    logo_reference character varying(255),
    primary_color character varying(7),
    secondary_color character varying(7),
    time_zone character varying(50) NOT NULL,
    organization_id uuid NOT NULL
);


--
-- Name: organization_working_days; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_working_days (
    settings_id uuid NOT NULL,
    working_day character varying(10) NOT NULL,
    CONSTRAINT organization_working_days_working_day_check CHECK (((working_day)::text = ANY ((ARRAY['MONDAY'::character varying, 'TUESDAY'::character varying, 'WEDNESDAY'::character varying, 'THURSDAY'::character varying, 'FRIDAY'::character varying, 'SATURDAY'::character varying, 'SUNDAY'::character varying])::text[])))
);


--
-- Name: organization_workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_workspaces (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    display_name character varying(150) NOT NULL,
    workspace_key character varying(63) NOT NULL,
    status character varying(20) NOT NULL,
    organization_id uuid NOT NULL,
    product_id uuid NOT NULL,
    CONSTRAINT organization_workspaces_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))
);


--
-- Name: organizations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organizations (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    activated_at timestamp(6) with time zone,
    cancelled_at timestamp(6) with time zone,
    legal_name character varying(255),
    name character varying(255) NOT NULL,
    organization_code character varying(255) NOT NULL,
    primary_email character varying(255) NOT NULL,
    primary_phone character varying(255),
    slug character varying(63),
    status character varying(20) NOT NULL,
    suspended_at timestamp(6) with time zone,
    trial_ends_at timestamp(6) with time zone,
    trial_started_at timestamp(6) with time zone,
    address_country character varying(2),
    address_line_1 character varying(255),
    address_line_2 character varying(255),
    city character varying(100),
    company_size character varying(30),
    description character varying(1000),
    industry character varying(100),
    postal_code character varying(20),
    state_province character varying(100),
    website character varying(255),
    CONSTRAINT organizations_status_check CHECK (((status)::text = ANY ((ARRAY['PENDING'::character varying, 'TRIAL'::character varying, 'ACTIVE'::character varying, 'SUSPENDED'::character varying, 'CANCELLED'::character varying, 'TERMINATED'::character varying])::text[])))
);


--
-- Name: plan_entitlements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plan_entitlements (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    boolean_value boolean,
    integer_value integer,
    entitlement_definition_id uuid NOT NULL,
    plan_id uuid NOT NULL
);


--
-- Name: plans; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.plans (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    description character varying(1000),
    display_name character varying(150) NOT NULL,
    plan_key character varying(100) NOT NULL,
    status character varying(20) NOT NULL,
    product_id uuid NOT NULL,
    CONSTRAINT plans_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))
);


--
-- Name: platform_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.platform_access (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    granted_at timestamp(6) with time zone NOT NULL,
    role character varying(20) NOT NULL,
    status character varying(20) NOT NULL,
    user_id uuid NOT NULL,
    CONSTRAINT platform_access_role_check CHECK (((role)::text = ANY ((ARRAY['SUPER_ADMIN'::character varying, 'ADMIN'::character varying, 'OPERATIONS'::character varying, 'SUPPORT'::character varying])::text[]))),
    CONSTRAINT platform_access_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'SUSPENDED'::character varying])::text[])))
);


--
-- Name: products; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.products (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    description character varying(1000),
    display_name character varying(150) NOT NULL,
    product_key character varying(63) NOT NULL,
    status character varying(20) NOT NULL,
    CONSTRAINT products_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))
);


--
-- Name: refresh_tokens; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_tokens (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    expires_at timestamp(6) with time zone NOT NULL,
    revoked boolean NOT NULL,
    revoked_at timestamp(6) with time zone,
    token_hash character varying(64) NOT NULL,
    user_id uuid NOT NULL
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    email character varying(255) NOT NULL,
    first_name character varying(255) NOT NULL,
    last_name character varying(255) NOT NULL,
    password_hash character varying(255) NOT NULL,
    status character varying(20) NOT NULL,
    CONSTRAINT users_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying, 'LOCKED'::character varying])::text[])))
);


--
-- Name: entitlement_definitions entitlement_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entitlement_definitions
    ADD CONSTRAINT entitlement_definitions_pkey PRIMARY KEY (id);


--
-- Name: organization_domains organization_domains_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_domains
    ADD CONSTRAINT organization_domains_pkey PRIMARY KEY (id);


--
-- Name: organization_invitations organization_invitations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT organization_invitations_pkey PRIMARY KEY (id);


--
-- Name: organization_memberships organization_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT organization_memberships_pkey PRIMARY KEY (id);


--
-- Name: organization_plan_assignments organization_plan_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_plan_assignments
    ADD CONSTRAINT organization_plan_assignments_pkey PRIMARY KEY (id);


--
-- Name: organization_settings organization_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT organization_settings_pkey PRIMARY KEY (id);


--
-- Name: organization_working_days organization_working_days_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_working_days
    ADD CONSTRAINT organization_working_days_pkey PRIMARY KEY (settings_id, working_day);


--
-- Name: organization_workspaces organization_workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_workspaces
    ADD CONSTRAINT organization_workspaces_pkey PRIMARY KEY (id);


--
-- Name: organizations organizations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT organizations_pkey PRIMARY KEY (id);


--
-- Name: plan_entitlements plan_entitlements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_entitlements
    ADD CONSTRAINT plan_entitlements_pkey PRIMARY KEY (id);


--
-- Name: plans plans_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT plans_pkey PRIMARY KEY (id);


--
-- Name: platform_access platform_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_access
    ADD CONSTRAINT platform_access_pkey PRIMARY KEY (id);


--
-- Name: products products_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT products_pkey PRIMARY KEY (id);


--
-- Name: refresh_tokens refresh_tokens_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT refresh_tokens_pkey PRIMARY KEY (id);


--
-- Name: plans uk4wyqdbcofmdmbl57wc7g05pqt; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT uk4wyqdbcofmdmbl57wc7g05pqt UNIQUE (plan_key);


--
-- Name: organization_memberships uk_org_membership_org_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT uk_org_membership_org_user UNIQUE (organization_id, user_id);


--
-- Name: organization_plan_assignments uk_org_plan_product; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_plan_assignments
    ADD CONSTRAINT uk_org_plan_product UNIQUE (organization_id, product_id);


--
-- Name: organization_domains uk_organization_domains_hostname; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_domains
    ADD CONSTRAINT uk_organization_domains_hostname UNIQUE (hostname);


--
-- Name: organizations uk_organizations_organization_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT uk_organizations_organization_code UNIQUE (organization_code);


--
-- Name: organizations uk_organizations_slug; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organizations
    ADD CONSTRAINT uk_organizations_slug UNIQUE (slug);


--
-- Name: plan_entitlements uk_plan_entitlement; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_entitlements
    ADD CONSTRAINT uk_plan_entitlement UNIQUE (plan_id, entitlement_definition_id);


--
-- Name: platform_access uk_platform_access_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_access
    ADD CONSTRAINT uk_platform_access_user UNIQUE (user_id);


--
-- Name: users uk_users_email; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT uk_users_email UNIQUE (email);


--
-- Name: organization_workspaces uk_workspace_org_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_workspaces
    ADD CONSTRAINT uk_workspace_org_key UNIQUE (organization_id, workspace_key);


--
-- Name: organization_invitations ukf2nlp3youqu2pmg4ixuay6ip9; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT ukf2nlp3youqu2pmg4ixuay6ip9 UNIQUE (token_hash);


--
-- Name: products ukie7q5j7dkkg1ejjwmm7qokt4o; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.products
    ADD CONSTRAINT ukie7q5j7dkkg1ejjwmm7qokt4o UNIQUE (product_key);


--
-- Name: refresh_tokens uko2mlirhldriil2y7krapq4frt; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT uko2mlirhldriil2y7krapq4frt UNIQUE (token_hash);


--
-- Name: organization_settings ukpvaf5lrlvqte57jpa89crhfso; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT ukpvaf5lrlvqte57jpa89crhfso UNIQUE (organization_id);


--
-- Name: entitlement_definitions ukrft6p5dceiyxgbfef50n4va9w; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.entitlement_definitions
    ADD CONSTRAINT ukrft6p5dceiyxgbfef50n4va9w UNIQUE (entitlement_key);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: idx_entitlement_definitions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_entitlement_definitions_status ON public.entitlement_definitions USING btree (status);


--
-- Name: idx_plan_assignment_org; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_assignment_org ON public.organization_plan_assignments USING btree (organization_id);


--
-- Name: idx_plan_assignment_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_assignment_status ON public.organization_plan_assignments USING btree (status);


--
-- Name: idx_plan_entitlements_plan; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plan_entitlements_plan ON public.plan_entitlements USING btree (plan_id);


--
-- Name: idx_plans_product; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plans_product ON public.plans USING btree (product_id);


--
-- Name: idx_plans_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_plans_status ON public.plans USING btree (status);


--
-- Name: idx_products_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_products_status ON public.products USING btree (status);


--
-- Name: idx_workspace_organization; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_organization ON public.organization_workspaces USING btree (organization_id);


--
-- Name: idx_workspace_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_workspace_status ON public.organization_workspaces USING btree (status);


--
-- Name: refresh_tokens fk1lih5y2npsf8u5o3vhdb9y0os; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_tokens
    ADD CONSTRAINT fk1lih5y2npsf8u5o3vhdb9y0os FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: organization_memberships fk2o39jpg4nxk694dpxwgosp08r; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT fk2o39jpg4nxk694dpxwgosp08r FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: organization_invitations fk3trgbj3obx4llpsj3hjwuw355; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT fk3trgbj3obx4llpsj3hjwuw355 FOREIGN KEY (invited_by) REFERENCES public.users(id);


--
-- Name: organization_workspaces fk4fntrgk9l7ef8vetscxbupos6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_workspaces
    ADD CONSTRAINT fk4fntrgk9l7ef8vetscxbupos6 FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: organization_domains fk6bphj0h7ctj04agp4v2tqcykd; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_domains
    ADD CONSTRAINT fk6bphj0h7ctj04agp4v2tqcykd FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: organization_settings fkbaksp6cwe9kw9gpwf2u9mk9b6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_settings
    ADD CONSTRAINT fkbaksp6cwe9kw9gpwf2u9mk9b6 FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: plan_entitlements fkblnefun3vyc44hps0lh0hyymh; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_entitlements
    ADD CONSTRAINT fkblnefun3vyc44hps0lh0hyymh FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: organization_plan_assignments fkd8jw02x8chl2sq8f4qc9d805s; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_plan_assignments
    ADD CONSTRAINT fkd8jw02x8chl2sq8f4qc9d805s FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: organization_memberships fkedfr2sj5wsdjnrnwylkari8c2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_memberships
    ADD CONSTRAINT fkedfr2sj5wsdjnrnwylkari8c2 FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: organization_workspaces fki27g82w28ahxgywj4c80lnokt; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_workspaces
    ADD CONSTRAINT fki27g82w28ahxgywj4c80lnokt FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: organization_plan_assignments fkj03ad5wsa2w0rp4f4n7cwp133; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_plan_assignments
    ADD CONSTRAINT fkj03ad5wsa2w0rp4f4n7cwp133 FOREIGN KEY (plan_id) REFERENCES public.plans(id);


--
-- Name: organization_plan_assignments fkk2m60lcdkhu79kgrgwy2ere5o; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_plan_assignments
    ADD CONSTRAINT fkk2m60lcdkhu79kgrgwy2ere5o FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: plans fkk2rb2jagf4htdxtfbftjxo6pj; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plans
    ADD CONSTRAINT fkk2rb2jagf4htdxtfbftjxo6pj FOREIGN KEY (product_id) REFERENCES public.products(id);


--
-- Name: platform_access fkm5fywdyb1kgb94439w9subaqb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.platform_access
    ADD CONSTRAINT fkm5fywdyb1kgb94439w9subaqb FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: plan_entitlements fkmr22tj4pyqyryfbpn3eoqavry; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.plan_entitlements
    ADD CONSTRAINT fkmr22tj4pyqyryfbpn3eoqavry FOREIGN KEY (entitlement_definition_id) REFERENCES public.entitlement_definitions(id);


--
-- Name: organization_invitations fkpt2hiwb0x73kxxm65yxabtvc; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_invitations
    ADD CONSTRAINT fkpt2hiwb0x73kxxm65yxabtvc FOREIGN KEY (organization_id) REFERENCES public.organizations(id);


--
-- Name: organization_working_days fkt3hhowxv37yju61vqy90gqbkl; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_working_days
    ADD CONSTRAINT fkt3hhowxv37yju61vqy90gqbkl FOREIGN KEY (settings_id) REFERENCES public.organization_settings(id);


--
-- PostgreSQL database dump complete
--
