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
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    department_key character varying(63) NOT NULL,
    name character varying(150) NOT NULL,
    status character varying(20) NOT NULL,
    parent_department_id uuid,
    workspace_id uuid NOT NULL,
    CONSTRAINT departments_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))
);


--
-- Name: designations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.designations (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    designation_key character varying(63) NOT NULL,
    name character varying(150) NOT NULL,
    status character varying(20) NOT NULL,
    workspace_id uuid NOT NULL,
    CONSTRAINT designations_status_check CHECK (((status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'INACTIVE'::character varying])::text[])))
);


--
-- Name: employee_lifecycle_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employee_lifecycle_events (
    id uuid NOT NULL,
    action character varying(32) NOT NULL,
    new_status character varying(20) NOT NULL,
    occurred_at timestamp(6) with time zone NOT NULL,
    previous_status character varying(20),
    employee_id uuid NOT NULL,
    workspace_id uuid NOT NULL,
    CONSTRAINT employee_lifecycle_events_new_status_check CHECK (((new_status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'ON_LEAVE'::character varying, 'SUSPENDED'::character varying, 'RESIGNED'::character varying, 'TERMINATED'::character varying])::text[]))),
    CONSTRAINT employee_lifecycle_events_previous_status_check CHECK (((previous_status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'ON_LEAVE'::character varying, 'SUSPENDED'::character varying, 'RESIGNED'::character varying, 'TERMINATED'::character varying])::text[])))
);


--
-- Name: employees; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.employees (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    employee_code character varying(63) NOT NULL,
    first_name character varying(100) NOT NULL,
    joining_date date NOT NULL,
    last_name character varying(100) NOT NULL,
    middle_name character varying(100),
    phone character varying(30),
    platform_user_id uuid,
    employment_status character varying(20) NOT NULL,
    work_email character varying(254) NOT NULL,
    department_id uuid,
    designation_id uuid,
    reporting_manager_id uuid,
    workspace_id uuid NOT NULL,
    CONSTRAINT employees_employment_status_check CHECK (((employment_status)::text = ANY ((ARRAY['ACTIVE'::character varying, 'ON_LEAVE'::character varying, 'SUSPENDED'::character varying, 'RESIGNED'::character varying, 'TERMINATED'::character varying])::text[])))
);


--
-- Name: organization_change_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.organization_change_events (
    id uuid NOT NULL,
    action character varying(48) NOT NULL,
    new_value character varying(150),
    occurred_at timestamp(6) with time zone NOT NULL,
    previous_value character varying(150),
    resource_key character varying(63) NOT NULL,
    resource_type character varying(32) NOT NULL,
    workspace_id uuid NOT NULL
);


--
-- Name: workforce_workspaces; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.workforce_workspaces (
    id uuid NOT NULL,
    created_at timestamp(6) with time zone NOT NULL,
    updated_at timestamp(6) with time zone NOT NULL,
    workspace_key character varying(63) NOT NULL
);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: designations designations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT designations_pkey PRIMARY KEY (id);


--
-- Name: employee_lifecycle_events employee_lifecycle_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_lifecycle_events
    ADD CONSTRAINT employee_lifecycle_events_pkey PRIMARY KEY (id);


--
-- Name: employees employees_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT employees_pkey PRIMARY KEY (id);


--
-- Name: organization_change_events organization_change_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_change_events
    ADD CONSTRAINT organization_change_events_pkey PRIMARY KEY (id);


--
-- Name: departments uk_department_workspace_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT uk_department_workspace_key UNIQUE (workspace_id, department_key);


--
-- Name: designations uk_designation_workspace_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT uk_designation_workspace_key UNIQUE (workspace_id, designation_key);


--
-- Name: employees uk_employee_workspace_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT uk_employee_workspace_code UNIQUE (workspace_id, employee_code);


--
-- Name: employees uk_employee_workspace_platform_user; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT uk_employee_workspace_platform_user UNIQUE (workspace_id, platform_user_id);


--
-- Name: workforce_workspaces uk_workforce_workspace_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workforce_workspaces
    ADD CONSTRAINT uk_workforce_workspace_key UNIQUE (workspace_key);


--
-- Name: workforce_workspaces workforce_workspaces_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.workforce_workspaces
    ADD CONSTRAINT workforce_workspaces_pkey PRIMARY KEY (id);


--
-- Name: idx_department_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_department_status ON public.departments USING btree (status);


--
-- Name: idx_department_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_department_workspace ON public.departments USING btree (workspace_id);


--
-- Name: idx_designation_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designation_status ON public.designations USING btree (status);


--
-- Name: idx_designation_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_designation_workspace ON public.designations USING btree (workspace_id);


--
-- Name: idx_employee_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_status ON public.employees USING btree (employment_status);


--
-- Name: idx_employee_workspace; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_employee_workspace ON public.employees USING btree (workspace_id);


--
-- Name: idx_lifecycle_workspace_employee_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lifecycle_workspace_employee_time ON public.employee_lifecycle_events USING btree (workspace_id, employee_id, occurred_at);


--
-- Name: idx_org_change_workspace_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_org_change_workspace_time ON public.organization_change_events USING btree (workspace_id, occurred_at);


--
-- Name: designations fk6ofgh3fcg9rkjfv5fdqu09jex; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.designations
    ADD CONSTRAINT fk6ofgh3fcg9rkjfv5fdqu09jex FOREIGN KEY (workspace_id) REFERENCES public.workforce_workspaces(id);


--
-- Name: organization_change_events fk75f8mep39gce424kslhsuuj83; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.organization_change_events
    ADD CONSTRAINT fk75f8mep39gce424kslhsuuj83 FOREIGN KEY (workspace_id) REFERENCES public.workforce_workspaces(id);


--
-- Name: employee_lifecycle_events fkcxdblhwau767q4muah17fpvca; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_lifecycle_events
    ADD CONSTRAINT fkcxdblhwau767q4muah17fpvca FOREIGN KEY (workspace_id) REFERENCES public.workforce_workspaces(id);


--
-- Name: employees fkdgclygfkdtmfirnc85mo9akkk; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT fkdgclygfkdtmfirnc85mo9akkk FOREIGN KEY (workspace_id) REFERENCES public.workforce_workspaces(id);


--
-- Name: employees fke4i9i8vu1j96m71g4v98kqirb; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT fke4i9i8vu1j96m71g4v98kqirb FOREIGN KEY (designation_id) REFERENCES public.designations(id);


--
-- Name: departments fkf447ltyj9sprmddsd3day3lf3; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT fkf447ltyj9sprmddsd3day3lf3 FOREIGN KEY (parent_department_id) REFERENCES public.departments(id);


--
-- Name: employee_lifecycle_events fkgb8hobueojux1de0cokmow03t; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employee_lifecycle_events
    ADD CONSTRAINT fkgb8hobueojux1de0cokmow03t FOREIGN KEY (employee_id) REFERENCES public.employees(id);


--
-- Name: employees fkgy4qe3dnqrm3ktd76sxp7n4c2; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT fkgy4qe3dnqrm3ktd76sxp7n4c2 FOREIGN KEY (department_id) REFERENCES public.departments(id);


--
-- Name: departments fkh1bnby3gqh7a9xbhw36vrj8ba; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT fkh1bnby3gqh7a9xbhw36vrj8ba FOREIGN KEY (workspace_id) REFERENCES public.workforce_workspaces(id);


--
-- Name: employees fkj5dawmyfw3dmtixnsrr6cbk63; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.employees
    ADD CONSTRAINT fkj5dawmyfw3dmtixnsrr6cbk63 FOREIGN KEY (reporting_manager_id) REFERENCES public.employees(id);


--
-- PostgreSQL database dump complete
--
