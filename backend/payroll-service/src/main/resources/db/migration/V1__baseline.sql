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
-- Name: compensation_component_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compensation_component_assignments (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    configured_value numeric(19,4) NOT NULL,
    component_definition_id uuid CONSTRAINT compensation_component_assignm_component_definition_id_not_null NOT NULL,
    profile_id uuid NOT NULL,
    CONSTRAINT compensation_component_assignments_configured_value_check CHECK ((configured_value >= (0)::numeric))
);


--
-- Name: compensation_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.compensation_profiles (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    currency character varying(3) NOT NULL,
    effective_from date NOT NULL,
    effective_to date,
    profile_key character varying(64) NOT NULL,
    profile_status character varying(16) NOT NULL,
    payroll_employee_id uuid NOT NULL,
    CONSTRAINT compensation_profiles_check CHECK (((effective_to IS NULL) OR (effective_to >= effective_from))),
    CONSTRAINT compensation_profiles_profile_status_check CHECK (((profile_status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))
);


--
-- Name: payroll_calculation_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_calculation_lines (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    amount_type character varying(20) NOT NULL,
    calculated_amount numeric(19,4) NOT NULL,
    category character varying(16) NOT NULL,
    component_key character varying(64) NOT NULL,
    configured_value numeric(19,4) NOT NULL,
    currency character varying(3) NOT NULL,
    display_name character varying(150) NOT NULL,
    occurrence character varying(16) NOT NULL,
    taxability character varying(16) NOT NULL,
    calculation_id uuid NOT NULL,
    CONSTRAINT payroll_calculation_lines_amount_type_check CHECK (((amount_type)::text = ANY ((ARRAY['FIXED_AMOUNT'::character varying, 'PERCENTAGE'::character varying])::text[]))),
    CONSTRAINT payroll_calculation_lines_category_check CHECK (((category)::text = ANY ((ARRAY['EARNING'::character varying, 'DEDUCTION'::character varying])::text[]))),
    CONSTRAINT payroll_calculation_lines_check CHECK (((configured_value >= (0)::numeric) AND (calculated_amount >= (0)::numeric))),
    CONSTRAINT payroll_calculation_lines_occurrence_check CHECK (((occurrence)::text = ANY ((ARRAY['RECURRING'::character varying, 'ONE_TIME'::character varying])::text[]))),
    CONSTRAINT payroll_calculation_lines_taxability_check CHECK (((taxability)::text = ANY ((ARRAY['TAXABLE'::character varying, 'NON_TAXABLE'::character varying])::text[])))
);


--
-- Name: payroll_calculations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_calculations (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    calculation_date date NOT NULL,
    currency character varying(3) NOT NULL,
    deduction_amount numeric(19,4) NOT NULL,
    employee_code character varying(64) NOT NULL,
    gross_amount numeric(19,4) NOT NULL,
    net_amount numeric(19,4) NOT NULL,
    workspace_id uuid NOT NULL,
    CONSTRAINT payroll_calculations_check CHECK (((gross_amount >= (0)::numeric) AND (deduction_amount >= (0)::numeric) AND (net_amount >= (0)::numeric)))
);


--
-- Name: payroll_component_definitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_component_definitions (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    amount_type character varying(20) NOT NULL,
    category character varying(16) NOT NULL,
    component_key character varying(64) NOT NULL,
    display_name character varying(150) NOT NULL,
    occurrence_type character varying(16) NOT NULL,
    component_status character varying(16) NOT NULL,
    taxability character varying(16) NOT NULL,
    workspace_id uuid NOT NULL,
    CONSTRAINT payroll_component_definitions_amount_type_check CHECK (((amount_type)::text = ANY ((ARRAY['FIXED_AMOUNT'::character varying, 'PERCENTAGE'::character varying])::text[]))),
    CONSTRAINT payroll_component_definitions_category_check CHECK (((category)::text = ANY ((ARRAY['EARNING'::character varying, 'DEDUCTION'::character varying])::text[]))),
    CONSTRAINT payroll_component_definitions_component_status_check CHECK (((component_status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[]))),
    CONSTRAINT payroll_component_definitions_occurrence_type_check CHECK (((occurrence_type)::text = ANY ((ARRAY['RECURRING'::character varying, 'ONE_TIME'::character varying])::text[]))),
    CONSTRAINT payroll_component_definitions_taxability_check CHECK (((taxability)::text = ANY ((ARRAY['TAXABLE'::character varying, 'NON_TAXABLE'::character varying])::text[])))
);


--
-- Name: payroll_employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_employees (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    currency character varying(3) NOT NULL,
    effective_from date NOT NULL,
    employee_code character varying(63) NOT NULL,
    pay_frequency character varying(16) NOT NULL,
    payroll_status character varying(16) NOT NULL,
    workspace_id uuid NOT NULL,
    CONSTRAINT payroll_employees_pay_frequency_check CHECK (((pay_frequency)::text = ANY ((ARRAY['MONTHLY'::character varying, 'BIWEEKLY'::character varying, 'WEEKLY'::character varying])::text[]))),
    CONSTRAINT payroll_employees_payroll_status_check CHECK (((payroll_status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))
);


--
-- Name: payroll_pay_run_employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_pay_run_employees (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    currency_snapshot character varying(3) NOT NULL,
    deduction_snapshot numeric(19,4) NOT NULL,
    employee_code character varying(64) NOT NULL,
    gross_snapshot numeric(19,4) NOT NULL,
    net_snapshot numeric(19,4) NOT NULL,
    calculation_id uuid,
    pay_run_id uuid NOT NULL,
    payroll_employee_id uuid NOT NULL,
    CONSTRAINT payroll_pay_run_employees_check CHECK (((gross_snapshot >= (0)::numeric) AND (deduction_snapshot >= (0)::numeric) AND (net_snapshot >= (0)::numeric)))
);


--
-- Name: payroll_pay_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_pay_runs (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    calculation_date date NOT NULL,
    currency character varying(3) NOT NULL,
    deduction_total numeric(19,4) NOT NULL,
    finalized_at timestamp(6) with time zone,
    gross_total numeric(19,4) NOT NULL,
    net_total numeric(19,4) NOT NULL,
    pay_run_key character varying(64) NOT NULL,
    period_end date NOT NULL,
    period_start date NOT NULL,
    pay_run_status character varying(16) NOT NULL,
    workspace_id uuid NOT NULL,
    CONSTRAINT payroll_pay_runs_check CHECK (((period_start <= period_end) AND (gross_total >= (0)::numeric) AND (deduction_total >= (0)::numeric) AND (net_total >= (0)::numeric))),
    CONSTRAINT payroll_pay_runs_pay_run_status_check CHECK (((pay_run_status)::text = ANY ((ARRAY['DRAFT'::character varying, 'PROCESSING'::character varying, 'CALCULATED'::character varying, 'FINALIZED'::character varying, 'FAILED'::character varying])::text[])))
);


--
-- Name: payroll_workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.payroll_workspaces (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    workspace_key character varying(63) NOT NULL
);


--
-- Name: compensation_component_assignments compensation_component_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensation_component_assignments
    ADD CONSTRAINT compensation_component_assignments_pkey PRIMARY KEY (id);


--
-- Name: compensation_profiles compensation_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensation_profiles
    ADD CONSTRAINT compensation_profiles_pkey PRIMARY KEY (id);


--
-- Name: payroll_calculation_lines payroll_calculation_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_calculation_lines
    ADD CONSTRAINT payroll_calculation_lines_pkey PRIMARY KEY (id);


--
-- Name: payroll_calculations payroll_calculations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_calculations
    ADD CONSTRAINT payroll_calculations_pkey PRIMARY KEY (id);


--
-- Name: payroll_component_definitions payroll_component_definitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_component_definitions
    ADD CONSTRAINT payroll_component_definitions_pkey PRIMARY KEY (id);


--
-- Name: payroll_employees payroll_employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_employees
    ADD CONSTRAINT payroll_employees_pkey PRIMARY KEY (id);


--
-- Name: payroll_pay_run_employees payroll_pay_run_employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_pay_run_employees
    ADD CONSTRAINT payroll_pay_run_employees_pkey PRIMARY KEY (id);


--
-- Name: payroll_pay_runs payroll_pay_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_pay_runs
    ADD CONSTRAINT payroll_pay_runs_pkey PRIMARY KEY (id);


--
-- Name: payroll_workspaces payroll_workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_workspaces
    ADD CONSTRAINT payroll_workspaces_pkey PRIMARY KEY (id);


--
-- Name: compensation_component_assignments uk_assignment_profile_component; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensation_component_assignments
    ADD CONSTRAINT uk_assignment_profile_component UNIQUE (profile_id, component_definition_id);


--
-- Name: payroll_component_definitions uk_component_workspace_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_component_definitions
    ADD CONSTRAINT uk_component_workspace_key UNIQUE (workspace_id, component_key);


--
-- Name: payroll_pay_run_employees uk_pay_run_calculation; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_pay_run_employees
    ADD CONSTRAINT uk_pay_run_calculation UNIQUE (calculation_id);


--
-- Name: payroll_pay_run_employees uk_pay_run_employee; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_pay_run_employees
    ADD CONSTRAINT uk_pay_run_employee UNIQUE (pay_run_id, payroll_employee_id);


--
-- Name: payroll_pay_runs uk_pay_run_workspace_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_pay_runs
    ADD CONSTRAINT uk_pay_run_workspace_key UNIQUE (workspace_id, pay_run_key);


--
-- Name: payroll_employees uk_payroll_employee_workspace_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_employees
    ADD CONSTRAINT uk_payroll_employee_workspace_code UNIQUE (workspace_id, employee_code);


--
-- Name: payroll_workspaces uk_payroll_workspace_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_workspaces
    ADD CONSTRAINT uk_payroll_workspace_key UNIQUE (workspace_key);


--
-- Name: compensation_profiles uk_profile_employee_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensation_profiles
    ADD CONSTRAINT uk_profile_employee_key UNIQUE (payroll_employee_id, profile_key);


--
-- Name: idx_assignment_profile; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_assignment_profile ON public.compensation_component_assignments USING btree (profile_id);


--
-- Name: idx_calculation_employee_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calculation_employee_date ON public.payroll_calculations USING btree (workspace_id, employee_code, calculation_date);


--
-- Name: idx_calculation_line_calculation; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calculation_line_calculation ON public.payroll_calculation_lines USING btree (calculation_id);


--
-- Name: idx_calculation_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_calculation_workspace ON public.payroll_calculations USING btree (workspace_id);


--
-- Name: idx_component_workspace_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_component_workspace_status ON public.payroll_component_definitions USING btree (workspace_id, component_status);


--
-- Name: idx_pay_run_employee; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pay_run_employee ON public.payroll_pay_run_employees USING btree (pay_run_id, employee_code);


--
-- Name: idx_pay_run_workspace_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pay_run_workspace_key ON public.payroll_pay_runs USING btree (workspace_id, pay_run_key);


--
-- Name: idx_pay_run_workspace_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_pay_run_workspace_status ON public.payroll_pay_runs USING btree (workspace_id, pay_run_status);


--
-- Name: idx_payroll_employee_workspace_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_payroll_employee_workspace_status ON public.payroll_employees USING btree (workspace_id, payroll_status);


--
-- Name: idx_profile_employee_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_profile_employee_dates ON public.compensation_profiles USING btree (payroll_employee_id, effective_from, effective_to);


--
-- Name: payroll_pay_run_employees fk2ivp6q1038aeji34msm7jt9gv; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_pay_run_employees
    ADD CONSTRAINT fk2ivp6q1038aeji34msm7jt9gv FOREIGN KEY (pay_run_id) REFERENCES public.payroll_pay_runs(id);


--
-- Name: payroll_employees fk4b93xr0n906vpuj171jhfbemk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_employees
    ADD CONSTRAINT fk4b93xr0n906vpuj171jhfbemk FOREIGN KEY (workspace_id) REFERENCES public.payroll_workspaces(id);


--
-- Name: payroll_pay_run_employees fk4ffg07qavnrj8gm6cvefs6smb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_pay_run_employees
    ADD CONSTRAINT fk4ffg07qavnrj8gm6cvefs6smb FOREIGN KEY (payroll_employee_id) REFERENCES public.payroll_employees(id);


--
-- Name: compensation_component_assignments fk5vqebyuopgs2a1sr67x09gn21; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensation_component_assignments
    ADD CONSTRAINT fk5vqebyuopgs2a1sr67x09gn21 FOREIGN KEY (profile_id) REFERENCES public.compensation_profiles(id);


--
-- Name: compensation_component_assignments fka7d6uucduw7q6r4hq690a4iwp; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensation_component_assignments
    ADD CONSTRAINT fka7d6uucduw7q6r4hq690a4iwp FOREIGN KEY (component_definition_id) REFERENCES public.payroll_component_definitions(id);


--
-- Name: payroll_pay_runs fkbxsx5ms4yjykc5vt0ebbkd9eb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_pay_runs
    ADD CONSTRAINT fkbxsx5ms4yjykc5vt0ebbkd9eb FOREIGN KEY (workspace_id) REFERENCES public.payroll_workspaces(id);


--
-- Name: payroll_calculations fkgsxwa2labjsj27t9a2cq0kxf6; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_calculations
    ADD CONSTRAINT fkgsxwa2labjsj27t9a2cq0kxf6 FOREIGN KEY (workspace_id) REFERENCES public.payroll_workspaces(id);


--
-- Name: payroll_pay_run_employees fkiebqmf6qv1eei6xf2c3vhxhoi; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_pay_run_employees
    ADD CONSTRAINT fkiebqmf6qv1eei6xf2c3vhxhoi FOREIGN KEY (calculation_id) REFERENCES public.payroll_calculations(id);


--
-- Name: compensation_profiles fkkhcvypcvavt097aovh2ft4i4t; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.compensation_profiles
    ADD CONSTRAINT fkkhcvypcvavt097aovh2ft4i4t FOREIGN KEY (payroll_employee_id) REFERENCES public.payroll_employees(id);


--
-- Name: payroll_calculation_lines fklcgxrspddiq9i45bucle2cngb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_calculation_lines
    ADD CONSTRAINT fklcgxrspddiq9i45bucle2cngb FOREIGN KEY (calculation_id) REFERENCES public.payroll_calculations(id);


--
-- Name: payroll_component_definitions fkn3adpruwp2bfrrjcik1t4a1b4; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.payroll_component_definitions
    ADD CONSTRAINT fkn3adpruwp2bfrrjcik1t4a1b4 FOREIGN KEY (workspace_id) REFERENCES public.payroll_workspaces(id);


--
-- PostgreSQL database dump complete
--
