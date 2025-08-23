--
-- PostgreSQL database dump
--

\restrict iNSFfwMEmiyhilTSYMnoUBrNi6Gcj1FjD12CnETCDE83TxfNSSNcStqyfJDVVLs

-- Dumped from database version 17.4
-- Dumped by pg_dump version 17.6 (Ubuntu 17.6-1.pgdg24.04+1)

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
-- Data for Name: patients; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.patients VALUES ('06ab42ad-0347-4ced-aa11-5551aae5f078', 'Maria Luiza ', '', NULL, NULL, '2025-08-22 00:00:48.502357+00', '2025-08-22 00:00:48.502357+00');


--
-- Data for Name: professionals; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.professionals VALUES ('188e7dac-4a1b-4444-95ec-9a4ea3f8eebb', 'Beatriz ', 'Fonoaudióloga ', 'https://images.pexels.com/photos/5452201/pexels-photo-5452201.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop', 130, 0, true, '2025-08-22 00:05:41.121752+00', '2025-08-22 00:05:41.121752+00', 20);
INSERT INTO public.professionals VALUES ('716440d6-53f9-40f4-bb5d-f556f39a2f6b', 'Célia ', 'Psicopedagoga ', 'https://images.pexels.com/photos/5452201/pexels-photo-5452201.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop', 130, 0, true, '2025-08-22 00:05:58.794738+00', '2025-08-22 00:05:58.794738+00', 20);
INSERT INTO public.professionals VALUES ('3972b145-4b0e-448a-817d-13fe10e68d67', 'Laudicéia ', 'Fonoaudióloga ', 'https://images.pexels.com/photos/5452201/pexels-photo-5452201.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop', 130, 0, true, '2025-08-22 00:05:24.664229+00', '2025-08-22 00:05:24.664229+00', 20);
INSERT INTO public.professionals VALUES ('8ad944ab-9482-4365-bd58-46ebc7898b2b', 'Kleber ', 'Psicólogo ', 'https://images.pexels.com/photos/5452201/pexels-photo-5452201.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop', 130, 0, true, '2025-08-22 00:05:07.136625+00', '2025-08-22 00:05:07.136625+00', 20);
INSERT INTO public.professionals VALUES ('023851cc-ceee-4d04-9348-2c3067c15cb2', 'Valquíria lima', 'Psicóloga ', 'https://images.pexels.com/photos/5452201/pexels-photo-5452201.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop', 130, 0, true, '2025-08-22 00:04:47.573186+00', '2025-08-22 00:04:47.573186+00', 20);
INSERT INTO public.professionals VALUES ('69be249e-769a-40cb-8983-cf0bd625fbb2', 'Ideiva Barros ', 'Psicóloga clínica ', 'https://images.pexels.com/photos/5452201/pexels-photo-5452201.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&fit=crop', 200, 0, true, '2025-08-21 23:57:30.366047+00', '2025-08-21 23:57:30.366047+00', 20);


--
-- Data for Name: appointment_history; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: appointment_journeys; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.appointment_journeys VALUES ('29c54b1f-7961-4b2e-8de9-d85d57f83940', '69be249e-769a-40cb-8983-cf0bd625fbb2', 'Ideiva Barros ', '2025-08-21', '21:00', '22:59', 119, 0, 1, 200, 'Consulta', 'clinica', '2025-08-21 23:59:30.643378+00', '2025-08-21 23:59:30.643378+00', 100);
INSERT INTO public.appointment_journeys VALUES ('40cc48c6-89ea-47cd-8064-e3ca6423da98', '69be249e-769a-40cb-8983-cf0bd625fbb2', 'Ideiva Barros ', '2025-08-27', '14:00', '14:30', 30, 0, 1, 130, 'Consulta', 'clinica', '2025-08-22 00:02:44.618883+00', '2025-08-22 00:02:44.618883+00', 100);
INSERT INTO public.appointment_journeys VALUES ('d117aca1-442b-45cd-af75-8ffa365c518d', '69be249e-769a-40cb-8983-cf0bd625fbb2', 'Ideiva Barros ', '2025-08-27', '15:00', '15:30', 30, 0, 1, 130, 'Consulta', 'clinica', '2025-08-22 00:03:50.28233+00', '2025-08-22 00:03:50.28233+00', 100);
INSERT INTO public.appointment_journeys VALUES ('88fe59df-8868-4182-9916-e81c474d84bd', '023851cc-ceee-4d04-9348-2c3067c15cb2', 'Valquíria lima', '2025-08-27', '08:00', '08:30', 30, 0, 1, 130, 'Terapia', 'clinica', '2025-08-22 00:28:14.712274+00', '2025-08-22 00:28:14.712274+00', 20);
INSERT INTO public.appointment_journeys VALUES ('e8d072f0-dbf0-4173-8e4d-c19a1c45d83c', '023851cc-ceee-4d04-9348-2c3067c15cb2', 'Valquíria lima', '2025-08-27', '08:30', '09:00', 30, 0, 1, 40, 'Terapia', 'clinica', '2025-08-22 00:30:26.310224+00', '2025-08-22 00:30:26.310224+00', 20);
INSERT INTO public.appointment_journeys VALUES ('6b4da332-c014-4d1f-a148-032c26136eee', '023851cc-ceee-4d04-9348-2c3067c15cb2', 'Valquíria lima', '2025-08-27', '09:00', '09:30', 30, 0, 1, 130, 'Terapia', 'clinica', '2025-08-22 00:31:37.796637+00', '2025-08-22 00:31:37.796637+00', 20);
INSERT INTO public.appointment_journeys VALUES ('841970d9-8098-421c-a0af-0683f4dfb6ae', '023851cc-ceee-4d04-9348-2c3067c15cb2', 'Valquíria lima', '2025-08-27', '10:00', '10:30', 30, 0, 1, 130, 'Terapia', 'clinica', '2025-08-22 00:32:22.048058+00', '2025-08-22 00:32:22.048058+00', 20);


--
-- Data for Name: appointment_slots; Type: TABLE DATA; Schema: public; Owner: -
--

INSERT INTO public.appointment_slots VALUES ('5a9e3db8-660e-456e-b90f-780d9c575a3a', '29c54b1f-7961-4b2e-8de9-d85d57f83940', '69be249e-769a-40cb-8983-cf0bd625fbb2', '06ab42ad-0347-4ced-aa11-5551aae5f078', 1, '21:00', '22:59', '2025-08-21', 'agendado', 'Consulta', 200, 'clinica', 'Maria Luiza ', '', 'Hoje foi falado sobre confiança , ciúmes e poder sentir e falar sobre ', '2025-08-21 23:59:30.763318+00', '2025-08-21 23:59:30.763318+00', 100, NULL, NULL, NULL);
INSERT INTO public.appointment_slots VALUES ('5029d20f-08c8-4eb1-9b5b-e47da549740e', '40cc48c6-89ea-47cd-8064-e3ca6423da98', '69be249e-769a-40cb-8983-cf0bd625fbb2', NULL, 1, '14:00', '14:30', '2025-08-27', 'disponivel', 'Consulta', 130, 'clinica', NULL, NULL, NULL, '2025-08-22 00:02:44.717076+00', '2025-08-22 00:02:44.717076+00', 100, NULL, NULL, NULL);
INSERT INTO public.appointment_slots VALUES ('82bc9b36-0971-485c-8ee5-1eb690aaee08', 'd117aca1-442b-45cd-af75-8ffa365c518d', '69be249e-769a-40cb-8983-cf0bd625fbb2', NULL, 1, '15:00', '15:30', '2025-08-27', 'disponivel', 'Consulta', 130, 'clinica', NULL, NULL, NULL, '2025-08-22 00:04:04.357191+00', '2025-08-22 00:04:04.357191+00', 100, NULL, NULL, NULL);
INSERT INTO public.appointment_slots VALUES ('4ba6da6d-8ce7-4754-b199-bc3754ce405c', '88fe59df-8868-4182-9916-e81c474d84bd', '023851cc-ceee-4d04-9348-2c3067c15cb2', NULL, 1, '08:00', '08:30', '2025-08-27', 'disponivel', 'Terapia', 130, 'clinica', NULL, NULL, NULL, '2025-08-22 00:28:14.945032+00', '2025-08-22 00:28:14.945032+00', 20, NULL, NULL, NULL);
INSERT INTO public.appointment_slots VALUES ('8ff2ffc6-2a3d-4341-bf7e-c1bec3a6dd01', 'e8d072f0-dbf0-4173-8e4d-c19a1c45d83c', '023851cc-ceee-4d04-9348-2c3067c15cb2', NULL, 1, '08:30', '09:00', '2025-08-27', 'disponivel', 'Terapia', 40, 'clinica', NULL, NULL, NULL, '2025-08-22 00:30:26.450676+00', '2025-08-22 00:30:26.450676+00', 20, NULL, NULL, NULL);
INSERT INTO public.appointment_slots VALUES ('84aef91c-1a9c-41e2-b507-97d8c780d7e2', '6b4da332-c014-4d1f-a148-032c26136eee', '023851cc-ceee-4d04-9348-2c3067c15cb2', NULL, 1, '09:00', '09:30', '2025-08-27', 'disponivel', 'Terapia', 130, 'clinica', NULL, NULL, NULL, '2025-08-22 00:31:37.936737+00', '2025-08-22 00:31:37.936737+00', 20, NULL, NULL, NULL);
INSERT INTO public.appointment_slots VALUES ('7b39e2f0-57bd-4621-962d-0ff0c852c677', '841970d9-8098-421c-a0af-0683f4dfb6ae', '023851cc-ceee-4d04-9348-2c3067c15cb2', NULL, 1, '10:00', '10:30', '2025-08-27', 'disponivel', 'Terapia', 130, 'clinica', NULL, NULL, NULL, '2025-08-22 00:32:22.155643+00', '2025-08-22 00:32:22.155643+00', 20, NULL, NULL, NULL);


--
-- Data for Name: appointments; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: financial_entries; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- Data for Name: transactions; Type: TABLE DATA; Schema: public; Owner: -
--



--
-- PostgreSQL database dump complete
--

\unrestrict iNSFfwMEmiyhilTSYMnoUBrNi6Gcj1FjD12CnETCDE83TxfNSSNcStqyfJDVVLs

