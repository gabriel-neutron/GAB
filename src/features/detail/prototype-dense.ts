/**
 * **PROTOTYPE — the density probe, written to be read.**
 *
 * The operator says a real node carries more than a hundred values. The sample of #46 carries
 * three, so no layout can be judged on it. This file invents **one plausible vessel record**: 100
 * claims, 14 documents, 4 relations and one pending proposal, in the shape a real dossier takes.
 *
 * **Every row is invented.** No claim here is about a real vessel, company or person, and no
 * address resolves. It is a measuring stick for the screen, and it is deleted with the rest of
 * the prototype. It lives inside the feature, so `src/shared/fixtures/` is untouched and the
 * other three prototypes see nothing of it.
 *
 * It is reached at `/entity/probe-dense`.
 */

import type { Attribute, DocumentRow, Entity, Proposal, Relation } from '@/shared/fixtures/types';

export const DENSE_ENTITY_ID = 'probe-dense';

const OWNER_ID = 'probe-owner';
const MANAGER_ID = 'probe-manager';
const TERMINAL_ID = 'probe-terminal';

/* ------------------------------------------------------------------------------- documents */

const IHS = 'doc_1a4f27';
const REG = 'doc_2b7c15';
const CLASS = 'doc_3c9d08';
const EQUASIS = 'doc_4d2e63';
const AIS = 'doc_5e8a11';
const PORT = 'doc_6f3b90';
const PANDI = 'doc_70c4a2';
const FIXTURE = 'doc_81d5b3';
const SDN = 'doc_92e6c4';
const PRESS = 'doc_a3f7d5';
const ANNUAL = 'doc_b408e6';
const GISIS = 'doc_c519f7';
const BILL = 'doc_d62a08';
const MANUAL = 'manual';

export const denseDocuments: readonly DocumentRow[] = [
  doc(IHS, 'report', 'Vessel particulars extract — MV Aegean Trader', 'particulars/9482137', '2026-06-04', 'A2', 'machine'),
  doc(REG, 'url', 'Panama Maritime Authority — registry entry 55129014', 'registry/pa-55129014', '2026-05-28', 'A1', 'human'),
  doc(CLASS, 'report', 'ClassNK — survey status report, AEG-2026-114', 'class/aeg-2026-114', '2026-05-12', 'B2', 'machine'),
  doc(EQUASIS, 'url', 'Equasis — ownership and management record', 'equasis/9482137', '2026-06-01', 'B3', 'machine'),
  doc(AIS, 'api', 'AIS track export, January to July 2026', 'ais/9482137-h1-2026', '2026-07-02', 'C3', 'machine'),
  doc(PORT, 'file', 'Port of Rotterdam — berth log, second quarter 2026', 'ports/rtm-q2-2026', '2026-07-14', 'B2', 'arbitrated'),
  doc(PANDI, 'file', 'Protection and indemnity club — certificate of entry', 'pandi/cert-9482137', '2026-02-20', 'A2', 'human'),
  doc(FIXTURE, 'file', 'Fixture note — voyage charter, Tubarão to Rotterdam', 'fixtures/tub-rtm-0426', '2026-04-26', 'C4', 'arbitrated'),
  doc(SDN, 'url', 'Sanctions list entry — designated vessel record', 'sanctions/list-entry-4471', '2026-06-30', 'A1', 'human'),
  // Unrated. Invariant 6 makes the rating and its origin absent together.
  doc(PRESS, 'url', 'Trade press article on the Aegean fleet', 'press/aegean-fleet-note', '2026-07-09', null, null),
  doc(ANNUAL, 'report', 'Aegean Bulk Holdings SA — annual report 2025', 'filings/abh-2025', '2026-03-31', 'B2', 'machine'),
  doc(GISIS, 'api', 'Casualty and incident record, 2018 to 2026', 'casualty/9482137', '2026-06-11', 'A2', 'machine'),
  // No address at all: a scan that entered through `put_document` and nothing else.
  {
    id: BILL,
    kind: 'file',
    title: 'Bill of lading, scanned',
    uri: null,
    archiveUri: null,
    sha256: 'd62a0871b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d',
    retrievedAt: '2026-05-03',
    admiralty: 'D4',
    admiraltyOrigin: 'arbitrated',
  },
];

function doc(
  id: string,
  kind: DocumentRow['kind'],
  title: string,
  path: string,
  retrievedAt: string,
  admiralty: string | null,
  admiraltyOrigin: DocumentRow['admiraltyOrigin'],
): DocumentRow {
  return {
    id,
    kind,
    title,
    uri: `https://example.invalid/${path}`,
    archiveUri: `https://web.archive.example.invalid/2026/${path}`,
    sha256: `${id.slice(4)}b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f6071829${id.slice(4)}`,
    retrievedAt,
    admiralty,
    admiraltyOrigin,
  };
}

/* ---------------------------------------------------------------------------------- claims */

function at(v: Attribute['v'], ...src: string[]): Attribute {
  return { v, src };
}

const denseAttrs: Readonly<Record<string, Attribute>> = {
  // Identity
  imo_number: at('9482137', IHS, REG),
  mmsi: at('351884000', AIS),
  call_sign: at('3FKL9', REG),
  vessel_name: at('MV Aegean Trader', IHS),
  former_names: at(['Northern Ledger', 'Cape Iris'], IHS, EQUASIS),
  flag_state: at('Panama', REG),
  port_of_registry: at('Panama City', REG),
  official_number: at('55129014', REG),
  vessel_type: at('Bulk carrier, Panamax', IHS),
  hull_number: at('S-1187', IHS),
  keel_laid_on: at('2010-08-16', IHS),
  delivered_on: at('2011-03-09', IHS),

  // Dimensions
  length_overall_m: at(224.94, IHS),
  beam_moulded_m: at(32.26, IHS),
  depth_moulded_m: at(19.6, IHS),
  summer_draught_m: at(14.08, IHS),
  gross_tonnage: at(40255, IHS, REG),
  net_tonnage: at(24812, REG),
  deadweight_t: at(76500, IHS),
  lightship_t: at(11940, IHS),
  grain_capacity_m3: at(89100, IHS),
  bale_capacity_m3: at(86400, IHS),
  holds_count: at(7, IHS),
  hatches_count: at(7, IHS),

  // Machinery
  engine_builder: at('Hyundai, under licence', IHS),
  engine_model: at('MAN B&W 6S60MC-C', IHS),
  engine_power_kw: at(11300, IHS),
  engine_rpm: at(105, IHS),
  propellers_count: at(1, IHS),
  bunker_capacity_t: at(2350, IHS),
  service_speed_kn: at(14.2, IHS),
  maximum_speed_kn: at(15.6, AIS),
  daily_consumption_t: at(28.4, FIXTURE),
  auxiliary_engines: at(['3 × 480 kW'], IHS),

  // Class and survey
  class_society: at('ClassNK', CLASS),
  class_notation: at('NS* (Bulk Carrier, ESP) MNS*', CLASS),
  ice_class: at('none', CLASS),
  class_status: at('In class', CLASS),
  last_special_survey_on: at('2024-02-11', CLASS),
  next_special_survey_due: at('2029-02-10', CLASS),
  last_drydock_on: at('2024-02-03', CLASS),
  next_drydock_due: at('2027-02-02', CLASS),
  last_annual_survey_on: at('2026-01-27', CLASS),
  condition_assessment: at('Satisfactory, two recommendations open', CLASS),
  psc_detentions_5y: at(1, GISIS),
  last_psc_inspection_on: at('2026-04-18', GISIS),

  // Equipment and compliance
  cranes_fitted: at(true, IHS),
  crane_safe_working_load_t: at(30, IHS),
  scrubber_fitted: at(true, CLASS),
  scrubber_type: at('Open loop', CLASS),
  ballast_water_system_fitted: at(true, CLASS),
  ballast_water_system_maker: at('Alfa Sep BWTS-2000', CLASS),
  eedi_attained: at(3.71, CLASS),
  carbon_intensity_rating: at('D', CLASS),
  imo_number_marked_on_hull: at(true, PORT),
  safety_management_certificate_expiry: at('2027-06-30', CLASS),
  ship_security_certificate_expiry: at('2027-06-30', CLASS),
  maritime_labour_certificate_expiry: at('2028-01-15', CLASS),

  // Ownership and commercial
  registered_owner: at('Aegean Trader Shipping SA', EQUASIS, REG),
  beneficial_owner: at('Aegean Bulk Holdings SA', EQUASIS, ANNUAL),
  ism_manager: at('Marlin Ship Management Ltd', EQUASIS),
  commercial_manager: at('Aegean Bulk Chartering Ltd', ANNUAL),
  technical_manager: at('Marlin Ship Management Ltd', EQUASIS),
  operator_current: at('Aegean Bulk Chartering Ltd', FIXTURE),
  group_beneficial_owner_count: at(3, ANNUAL, PRESS),
  ownership_share_pct: at(100, EQUASIS),
  purchase_price_musd: at(18.4, PRESS),
  purchase_date: at('2019-04-01', ANNUAL),
  mortgage_holder: at('Piraeus Maritime Bank', ANNUAL),
  protection_and_indemnity_club: at('Northern Mutual', PANDI),
  hull_and_machinery_insurer: at('Hellenic Marine Underwriters', PANDI),
  insured_value_musd: at(21.5, PANDI),

  // Movement
  last_port_call: at('Rotterdam, Maasvlakte, berth 12', PORT),
  last_port_call_on: at('2026-06-19', PORT),
  next_declared_port: at('Tubarão', AIS),
  estimated_arrival_on: at('2026-07-28', AIS),
  current_cargo: at('Iron ore fines', FIXTURE, BILL),
  cargo_tonnes: at(74210, BILL),
  laden_status: at(true, AIS),
  reported_draught_m: at(13.9, AIS),
  ais_gaps_count: at(4, AIS),
  longest_ais_gap_hours: at(31.5, AIS),
  last_ais_position_on: at('2026-07-01', AIS),
  reported_speed_kn: at(12.7, AIS),

  // Risk and compliance
  sanctions_listed: at(false, SDN),
  sanctions_lists_checked: at(['OFAC SDN', 'EU consolidated', 'UK OFSI'], SDN),
  flag_changes_5y: at(2, REG, EQUASIS),
  name_changes_5y: at(2, IHS),
  ship_to_ship_transfers_12m: at(1, AIS),
  dark_activity_suspected: at(true, AIS, PRESS),
  high_risk_area_calls: at(['Gulf of Guinea', 'Strait of Hormuz'], AIS),
  detention_history: at('Detained at Paranaguá, 2022, deficiencies rectified', GISIS),
  casualty_records_count: at(2, GISIS),
  last_casualty_on: at('2023-11-04', GISIS),
  crew_nationalities: at(['PH', 'UA', 'GR'], PANDI),
  crew_count: at(21, PANDI),

  // Hand entered by the analyst. M8 makes `manual` a real document.
  hull_note: at('Funnel repainted between the April and the June photograph.', MANUAL),
  inspection_note: at('Hold 4 coating worn on the port side, seen in the terminal photograph.', MANUAL),
  analyst_note: at('The two owner records disagree. See the contradicting relation below.', MANUAL),
  photograph_note: at('Three photographs held, 2026-04-11, 2026-06-19, 2026-06-21.', MANUAL),
};

/* -------------------------------------------------------------------------------- entities */

export const denseEntity: Entity = {
  id: DENSE_ENTITY_ID,
  type: 'vessel',
  label: 'MV Aegean Trader',
  attrs: denseAttrs,
  sources: [IHS, REG],
  geom: { lon: 4.0361, lat: 51.9553 },
  promotedFrom: 'probe-proposal-0001',
};

export const denseEntities: readonly Entity[] = [
  denseEntity,
  side(OWNER_ID, 'company', 'Aegean Bulk Holdings SA', ANNUAL),
  side(MANAGER_ID, 'company', 'Marlin Ship Management Ltd', EQUASIS),
  side(TERMINAL_ID, 'facility', 'Maasvlakte dry bulk terminal, berth 12', PORT),
];

function side(id: string, type: string, label: string, source: string): Entity {
  return {
    id,
    type,
    label,
    attrs: { name_recorded: at(label, source) },
    sources: [source],
    geom: null,
    promotedFrom: `probe-proposal-${id}`,
  };
}

/* ------------------------------------------------------------------------------- relations */

const OWNS_ID = 'probe-relation-owns';

export const denseRelations: readonly Relation[] = [
  {
    id: OWNS_ID,
    type: 'owns',
    srcKind: 'entity',
    srcId: OWNER_ID,
    dstKind: 'entity',
    dstId: DENSE_ENTITY_ID,
    attrs: { share_pct: at(100, EQUASIS) },
    sources: [EQUASIS, ANNUAL],
    validFrom: '2019-04-01',
    validTo: null,
    promotedFrom: 'probe-proposal-0002',
  },
  {
    id: 'probe-relation-manages',
    type: 'manages',
    srcKind: 'entity',
    srcId: MANAGER_ID,
    dstKind: 'entity',
    dstId: DENSE_ENTITY_ID,
    attrs: {},
    sources: [EQUASIS],
    validFrom: '2021-09-01',
    validTo: null,
    promotedFrom: 'probe-proposal-0003',
  },
  {
    id: 'probe-relation-berthed',
    type: 'berthed_at',
    srcKind: 'entity',
    srcId: DENSE_ENTITY_ID,
    dstKind: 'entity',
    dstId: TERMINAL_ID,
    attrs: { observed_on: at('2026-06-19', PORT) },
    sources: [PORT],
    validFrom: null,
    validTo: null,
    promotedFrom: 'probe-proposal-0004',
  },
  {
    // M4: the endpoint is a relation. The graph cannot draw this one.
    id: 'probe-relation-contradicts',
    type: 'contradicts',
    srcKind: 'entity',
    srcId: DENSE_ENTITY_ID,
    dstKind: 'relation',
    dstId: OWNS_ID,
    attrs: {
      note: at('The registry names a different owner for the same period.', REG),
    },
    sources: [REG],
    validFrom: null,
    validTo: null,
    promotedFrom: 'probe-proposal-0005',
  },
];

/* ------------------------------------------------------------------------------- proposals */

export const denseProposals: readonly Proposal[] = [
  {
    id: 'probe-proposal-pending-1',
    op: 'update_attrs',
    targetKind: 'entity',
    targetId: DENSE_ENTITY_ID,
    payload: { kind: 'attrs', attrs: { carbon_intensity_rating: at('E', CLASS) } },
    src: [CLASS],
    confidence: 0.78,
    dissent: true,
    authorRole: 'gabriel_agent',
    status: 'pending',
    callId: 'probe-call-0001',
    createdAt: '2026-07-08T10:15:00Z',
    decidedAt: null,
    decidedBy: null,
  },
];
