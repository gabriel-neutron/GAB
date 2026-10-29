-- =============================================================================================
-- 95 — the vocabularies                                                           RE-RUNNABLE
--
-- IT RUNS AFTER THE GRANTS. 20_views.sql drops and recreates every view, and a grant follows a
-- CREATE VIEW, so a data file that raises before 90_grants.sql would leave gabriel_read with no
-- SELECT on the new views.
--
-- THE TWO MARKED REGIONS BELOW ARE WRITTEN FROM THE MODULES THAT DECLARE THEM: an entity type
-- in src/shared/vocabulary/declarations.ts, and a relation type in
-- packages/proposal/src/relation-types.ts, because the door of the writer reads that list too,
-- and a package never imports from src/. `pnpm seed:vocabulary` emits both, an edit made by hand
-- between the markers is lost on the next emit, and a test compares the two with no database.
-- Every other line of this file is hand-written and the emitter never reads it. No role holds a
-- write on either table, and there is no propose-a-type path at run time: a row inserted by a
-- function exists in no .sql file, and ADR 0003 makes `pnpm db:reset` a routine step, so such
-- a row dies by ordinary work.
--
-- THERE IS NO ATTRIBUTE VOCABULARY, AND THAT IS M11. Migration 0010 dropped the table. An
-- attribute key is whatever a person or an agent writes.
--
-- IT ADDS AND IT UPDATES. IT NEVER DELETES. A word leaves service through `retired`, so its
-- history stays readable. The statement writes no such column, so a seeded word takes the
-- default of the table and is in service.
--
-- ADR 0003 NAMES THIS FILE. Rows are a third kind, beside tables and functions: a re-runnable
-- data file, running last, after the grants.
-- =============================================================================================

SET ROLE gabriel_owner;

-- M8. `manual` is a real document, so a hand-entered value can be scored and queried like any
-- other claim, and "everything that rests on the operator's authority alone" is one query.
INSERT INTO documents (id, kind, title)
VALUES ('manual', 'manual', 'Direct entry by the analyst')
ON CONFLICT (id) DO NOTHING;

-- THE SECOND RESERVED DOCUMENT, AND IT IS NOT A WEAKER `manual`. `manual` says the operator
-- vouches for the value in person. `inherited` says the opposite: nothing supports the value
-- here, and the claim stands on an ancestor which `src_inherited_from` names. The v1 corpus
-- needs it for 742 units, and inventing a citation for them would be a fabrication.
--
-- IT CARRIES NO RETRIEVAL DATE, AND THE ROW AND NOT THE KIND IS WHY. Since migration 0011
-- doc_retrieved_with_bytes demands a date of the BYTES, and this row holds no s3_key and no
-- sha256, so it needs none. Its kind is `manual`, which is a separate rule and it decides one
-- separate thing: `put_document` queues no work for it, because nothing is there to fetch.
-- Migration 0009 refuses it to the machine role beside `manual`.
INSERT INTO documents (id, kind, title)
VALUES ('inherited', 'manual',
        'No document supports this value; it is inherited from an ancestor')
ON CONFLICT (id) DO NOTHING;

-- ======================================================================= document_provider ===
-- HAND-WRITTEN, AND THIS FILE IS THE AUTHORITY FOR A LICENCE. One edited line moves every
-- document of that provider, so the statement updates the name and the licence of a row that
-- exists.
--
-- WHERE NO TEXT STATES A LICENCE, THE ROW TAKES AN INTERNAL ONE. CREA and EGRUL are `restricted`
-- until their terms are read. IMO GISIS and Equasis need a login, so they are
-- `registration-terms`. Each of these words is internal tier, so an error here can only hold a
-- document back, and it never publishes one.
--
-- `manual` AND `inherited` GET NO PROVIDER. A hand entry stays internal until a release decides
-- to publish the operator's own entries; `own` is the row it would take.
INSERT INTO document_provider (id, name, licence) VALUES
  ('eu_eurlex',           'EU EUR-Lex',                 'eu-reuse'),
  ('ofac_sdn',            'OFAC SDN',                   'public-domain'),
  ('uk_sanctions_list',   'UK sanctions list',          'ogl-v3'),
  ('eu_fsf',              'EU FSF',                     'eu-reuse'),
  ('gleif',               'GLEIF',                      'cc0'),
  ('crea',                'CREA',                       'restricted'),
  -- The United Nations asks for a written permission to redistribute Comtrade data.
  ('un_comtrade',         'UN Comtrade',                'restricted'),
  ('datalastic',          'Datalastic',                 'commercial-no-redistribution'),
  ('gfw',                 'GFW',                        'cc-by-nc-4.0'),
  ('imo_gisis',           'IMO GISIS',                  'registration-terms'),
  ('equasis',             'Equasis',                    'registration-terms'),
  ('opensanctions',       'OpenSanctions',              'cc-by-nc-4.0'),
  ('opencorporates',      'OpenCorporates',             'odbl'),
  ('mca21',               'MCA21',                      'paid-filing'),
  ('acra',                'ACRA',                       'paid-filing'),
  ('cyprus_registrar',    'Cyprus Registrar',           'paid-filing'),
  ('hk_icris',            'HK ICRIS',                   'paid-filing'),
  ('egrul',               'EGRUL',                      'restricted'),
  ('copernicus_sentinel', 'Sentinel-1/2 (Copernicus)',  'copernicus'),
  -- Only the 2016 layer of EOX: the service states CC BY 4.0 for it, and CC BY-NC-SA from 2018.
  ('eox_s2cloudless_2016', 'EOX Sentinel-2 cloudless 2016', 'cc-by-4.0'),
  ('osm',                 'OSM',                        'odbl'),
  -- The World Bank publishes its commodity price data under CC BY 4.0. Bruegel is `restricted`
  -- until its terms of reuse are read.
  ('world_bank',          'World Bank',                 'cc-by-4.0'),
  ('bruegel',             'Bruegel',                    'restricted'),
  -- Eurostat data is reusable under the reuse policy of the European Commission, with the source
  -- named. fetch_document names this provider only for a file of the Eurostat API.
  ('eurostat',            'Eurostat',                   'eu-reuse'),
  ('own',                 'own',                        'own')
ON CONFLICT (id) DO UPDATE SET
  name    = EXCLUDED.name,
  licence = EXCLUDED.licence;


-- ============================================================================== area_code ===
-- ADR 0030: THE CODES OF A REPORTER AND OF A PARTNER OF A FIGURE. A fixed reference list, and
-- not entities of the graph. The countries are the codes of ISO 3166-1 alpha-2, with their English
-- names, and XK for Kosovo, which the EU and Eurostat use. A group is a set of countries that a
-- source reports as one: OTHER is a partner that the source does not state. area_code_source
-- turns the codes of a source (Eurostat writes EL for Greece) into these codes.
INSERT INTO area_code (system, code, label) VALUES
  ('iso3166', 'AD', 'Andorra'),
  ('iso3166', 'AE', 'United Arab Emirates'),
  ('iso3166', 'AF', 'Afghanistan'),
  ('iso3166', 'AG', 'Antigua & Barbuda'),
  ('iso3166', 'AI', 'Anguilla'),
  ('iso3166', 'AL', 'Albania'),
  ('iso3166', 'AM', 'Armenia'),
  ('iso3166', 'AO', 'Angola'),
  ('iso3166', 'AQ', 'Antarctica'),
  ('iso3166', 'AR', 'Argentina'),
  ('iso3166', 'AS', 'American Samoa'),
  ('iso3166', 'AT', 'Austria'),
  ('iso3166', 'AU', 'Australia'),
  ('iso3166', 'AW', 'Aruba'),
  ('iso3166', 'AX', 'Åland Islands'),
  ('iso3166', 'AZ', 'Azerbaijan'),
  ('iso3166', 'BA', 'Bosnia & Herzegovina'),
  ('iso3166', 'BB', 'Barbados'),
  ('iso3166', 'BD', 'Bangladesh'),
  ('iso3166', 'BE', 'Belgium'),
  ('iso3166', 'BF', 'Burkina Faso'),
  ('iso3166', 'BG', 'Bulgaria'),
  ('iso3166', 'BH', 'Bahrain'),
  ('iso3166', 'BI', 'Burundi'),
  ('iso3166', 'BJ', 'Benin'),
  ('iso3166', 'BL', 'St. Barthélemy'),
  ('iso3166', 'BM', 'Bermuda'),
  ('iso3166', 'BN', 'Brunei'),
  ('iso3166', 'BO', 'Bolivia'),
  ('iso3166', 'BQ', 'Caribbean Netherlands'),
  ('iso3166', 'BR', 'Brazil'),
  ('iso3166', 'BS', 'Bahamas'),
  ('iso3166', 'BT', 'Bhutan'),
  ('iso3166', 'BV', 'Bouvet Island'),
  ('iso3166', 'BW', 'Botswana'),
  ('iso3166', 'BY', 'Belarus'),
  ('iso3166', 'BZ', 'Belize'),
  ('iso3166', 'CA', 'Canada'),
  ('iso3166', 'CC', 'Cocos (Keeling) Islands'),
  ('iso3166', 'CD', 'Congo - Kinshasa'),
  ('iso3166', 'CF', 'Central African Republic'),
  ('iso3166', 'CG', 'Congo - Brazzaville'),
  ('iso3166', 'CH', 'Switzerland'),
  ('iso3166', 'CI', 'Côte d’Ivoire'),
  ('iso3166', 'CK', 'Cook Islands'),
  ('iso3166', 'CL', 'Chile'),
  ('iso3166', 'CM', 'Cameroon'),
  ('iso3166', 'CN', 'China'),
  ('iso3166', 'CO', 'Colombia'),
  ('iso3166', 'CR', 'Costa Rica'),
  ('iso3166', 'CU', 'Cuba'),
  ('iso3166', 'CV', 'Cape Verde'),
  ('iso3166', 'CW', 'Curaçao'),
  ('iso3166', 'CX', 'Christmas Island'),
  ('iso3166', 'CY', 'Cyprus'),
  ('iso3166', 'CZ', 'Czechia'),
  ('iso3166', 'DE', 'Germany'),
  ('iso3166', 'DJ', 'Djibouti'),
  ('iso3166', 'DK', 'Denmark'),
  ('iso3166', 'DM', 'Dominica'),
  ('iso3166', 'DO', 'Dominican Republic'),
  ('iso3166', 'DZ', 'Algeria'),
  ('iso3166', 'EC', 'Ecuador'),
  ('iso3166', 'EE', 'Estonia'),
  ('iso3166', 'EG', 'Egypt'),
  ('iso3166', 'EH', 'Western Sahara'),
  ('iso3166', 'ER', 'Eritrea'),
  ('iso3166', 'ES', 'Spain'),
  ('iso3166', 'ET', 'Ethiopia'),
  ('iso3166', 'FI', 'Finland'),
  ('iso3166', 'FJ', 'Fiji'),
  ('iso3166', 'FK', 'Falkland Islands'),
  ('iso3166', 'FM', 'Micronesia'),
  ('iso3166', 'FO', 'Faroe Islands'),
  ('iso3166', 'FR', 'France'),
  ('iso3166', 'GA', 'Gabon'),
  ('iso3166', 'GB', 'United Kingdom'),
  ('iso3166', 'GD', 'Grenada'),
  ('iso3166', 'GE', 'Georgia'),
  ('iso3166', 'GF', 'French Guiana'),
  ('iso3166', 'GG', 'Guernsey'),
  ('iso3166', 'GH', 'Ghana'),
  ('iso3166', 'GI', 'Gibraltar'),
  ('iso3166', 'GL', 'Greenland'),
  ('iso3166', 'GM', 'Gambia'),
  ('iso3166', 'GN', 'Guinea'),
  ('iso3166', 'GP', 'Guadeloupe'),
  ('iso3166', 'GQ', 'Equatorial Guinea'),
  ('iso3166', 'GR', 'Greece'),
  ('iso3166', 'GS', 'South Georgia & South Sandwich Islands'),
  ('iso3166', 'GT', 'Guatemala'),
  ('iso3166', 'GU', 'Guam'),
  ('iso3166', 'GW', 'Guinea-Bissau'),
  ('iso3166', 'GY', 'Guyana'),
  ('iso3166', 'HK', 'Hong Kong SAR China'),
  ('iso3166', 'HM', 'Heard & McDonald Islands'),
  ('iso3166', 'HN', 'Honduras'),
  ('iso3166', 'HR', 'Croatia'),
  ('iso3166', 'HT', 'Haiti'),
  ('iso3166', 'HU', 'Hungary'),
  ('iso3166', 'ID', 'Indonesia'),
  ('iso3166', 'IE', 'Ireland'),
  ('iso3166', 'IL', 'Israel'),
  ('iso3166', 'IM', 'Isle of Man'),
  ('iso3166', 'IN', 'India'),
  ('iso3166', 'IO', 'British Indian Ocean Territory'),
  ('iso3166', 'IQ', 'Iraq'),
  ('iso3166', 'IR', 'Iran'),
  ('iso3166', 'IS', 'Iceland'),
  ('iso3166', 'IT', 'Italy'),
  ('iso3166', 'JE', 'Jersey'),
  ('iso3166', 'JM', 'Jamaica'),
  ('iso3166', 'JO', 'Jordan'),
  ('iso3166', 'JP', 'Japan'),
  ('iso3166', 'KE', 'Kenya'),
  ('iso3166', 'KG', 'Kyrgyzstan'),
  ('iso3166', 'KH', 'Cambodia'),
  ('iso3166', 'KI', 'Kiribati'),
  ('iso3166', 'KM', 'Comoros'),
  ('iso3166', 'KN', 'St. Kitts & Nevis'),
  ('iso3166', 'KP', 'North Korea'),
  ('iso3166', 'KR', 'South Korea'),
  ('iso3166', 'KW', 'Kuwait'),
  ('iso3166', 'KY', 'Cayman Islands'),
  ('iso3166', 'KZ', 'Kazakhstan'),
  ('iso3166', 'LA', 'Laos'),
  ('iso3166', 'LB', 'Lebanon'),
  ('iso3166', 'LC', 'St. Lucia'),
  ('iso3166', 'LI', 'Liechtenstein'),
  ('iso3166', 'LK', 'Sri Lanka'),
  ('iso3166', 'LR', 'Liberia'),
  ('iso3166', 'LS', 'Lesotho'),
  ('iso3166', 'LT', 'Lithuania'),
  ('iso3166', 'LU', 'Luxembourg'),
  ('iso3166', 'LV', 'Latvia'),
  ('iso3166', 'LY', 'Libya'),
  ('iso3166', 'MA', 'Morocco'),
  ('iso3166', 'MC', 'Monaco'),
  ('iso3166', 'MD', 'Moldova'),
  ('iso3166', 'ME', 'Montenegro'),
  ('iso3166', 'MF', 'St. Martin'),
  ('iso3166', 'MG', 'Madagascar'),
  ('iso3166', 'MH', 'Marshall Islands'),
  ('iso3166', 'MK', 'North Macedonia'),
  ('iso3166', 'ML', 'Mali'),
  ('iso3166', 'MM', 'Myanmar (Burma)'),
  ('iso3166', 'MN', 'Mongolia'),
  ('iso3166', 'MO', 'Macao SAR China'),
  ('iso3166', 'MP', 'Northern Mariana Islands'),
  ('iso3166', 'MQ', 'Martinique'),
  ('iso3166', 'MR', 'Mauritania'),
  ('iso3166', 'MS', 'Montserrat'),
  ('iso3166', 'MT', 'Malta'),
  ('iso3166', 'MU', 'Mauritius'),
  ('iso3166', 'MV', 'Maldives'),
  ('iso3166', 'MW', 'Malawi'),
  ('iso3166', 'MX', 'Mexico'),
  ('iso3166', 'MY', 'Malaysia'),
  ('iso3166', 'MZ', 'Mozambique'),
  ('iso3166', 'NA', 'Namibia'),
  ('iso3166', 'NC', 'New Caledonia'),
  ('iso3166', 'NE', 'Niger'),
  ('iso3166', 'NF', 'Norfolk Island'),
  ('iso3166', 'NG', 'Nigeria'),
  ('iso3166', 'NI', 'Nicaragua'),
  ('iso3166', 'NL', 'Netherlands'),
  ('iso3166', 'NO', 'Norway'),
  ('iso3166', 'NP', 'Nepal'),
  ('iso3166', 'NR', 'Nauru'),
  ('iso3166', 'NU', 'Niue'),
  ('iso3166', 'NZ', 'New Zealand'),
  ('iso3166', 'OM', 'Oman'),
  ('iso3166', 'PA', 'Panama'),
  ('iso3166', 'PE', 'Peru'),
  ('iso3166', 'PF', 'French Polynesia'),
  ('iso3166', 'PG', 'Papua New Guinea'),
  ('iso3166', 'PH', 'Philippines'),
  ('iso3166', 'PK', 'Pakistan'),
  ('iso3166', 'PL', 'Poland'),
  ('iso3166', 'PM', 'St. Pierre & Miquelon'),
  ('iso3166', 'PN', 'Pitcairn Islands'),
  ('iso3166', 'PR', 'Puerto Rico'),
  ('iso3166', 'PS', 'Palestinian Territories'),
  ('iso3166', 'PT', 'Portugal'),
  ('iso3166', 'PW', 'Palau'),
  ('iso3166', 'PY', 'Paraguay'),
  ('iso3166', 'QA', 'Qatar'),
  ('iso3166', 'RE', 'Réunion'),
  ('iso3166', 'RO', 'Romania'),
  ('iso3166', 'RS', 'Serbia'),
  ('iso3166', 'RU', 'Russia'),
  ('iso3166', 'RW', 'Rwanda'),
  ('iso3166', 'SA', 'Saudi Arabia'),
  ('iso3166', 'SB', 'Solomon Islands'),
  ('iso3166', 'SC', 'Seychelles'),
  ('iso3166', 'SD', 'Sudan'),
  ('iso3166', 'SE', 'Sweden'),
  ('iso3166', 'SG', 'Singapore'),
  ('iso3166', 'SH', 'St. Helena'),
  ('iso3166', 'SI', 'Slovenia'),
  ('iso3166', 'SJ', 'Svalbard & Jan Mayen'),
  ('iso3166', 'SK', 'Slovakia'),
  ('iso3166', 'SL', 'Sierra Leone'),
  ('iso3166', 'SM', 'San Marino'),
  ('iso3166', 'SN', 'Senegal'),
  ('iso3166', 'SO', 'Somalia'),
  ('iso3166', 'SR', 'Suriname'),
  ('iso3166', 'SS', 'South Sudan'),
  ('iso3166', 'ST', 'São Tomé & Príncipe'),
  ('iso3166', 'SV', 'El Salvador'),
  ('iso3166', 'SX', 'Sint Maarten'),
  ('iso3166', 'SY', 'Syria'),
  ('iso3166', 'SZ', 'Eswatini'),
  ('iso3166', 'TC', 'Turks & Caicos Islands'),
  ('iso3166', 'TD', 'Chad'),
  ('iso3166', 'TF', 'French Southern Territories'),
  ('iso3166', 'TG', 'Togo'),
  ('iso3166', 'TH', 'Thailand'),
  ('iso3166', 'TJ', 'Tajikistan'),
  ('iso3166', 'TK', 'Tokelau'),
  ('iso3166', 'TL', 'Timor-Leste'),
  ('iso3166', 'TM', 'Turkmenistan'),
  ('iso3166', 'TN', 'Tunisia'),
  ('iso3166', 'TO', 'Tonga'),
  ('iso3166', 'TR', 'Türkiye'),
  ('iso3166', 'TT', 'Trinidad & Tobago'),
  ('iso3166', 'TV', 'Tuvalu'),
  ('iso3166', 'TW', 'Taiwan'),
  ('iso3166', 'TZ', 'Tanzania'),
  ('iso3166', 'UA', 'Ukraine'),
  ('iso3166', 'UG', 'Uganda'),
  ('iso3166', 'UM', 'U.S. Outlying Islands'),
  ('iso3166', 'US', 'United States'),
  ('iso3166', 'UY', 'Uruguay'),
  ('iso3166', 'UZ', 'Uzbekistan'),
  ('iso3166', 'VA', 'Vatican City'),
  ('iso3166', 'VC', 'St. Vincent & Grenadines'),
  ('iso3166', 'VE', 'Venezuela'),
  ('iso3166', 'VG', 'British Virgin Islands'),
  ('iso3166', 'VI', 'U.S. Virgin Islands'),
  ('iso3166', 'VN', 'Vietnam'),
  ('iso3166', 'VU', 'Vanuatu'),
  ('iso3166', 'WF', 'Wallis & Futuna'),
  ('iso3166', 'WS', 'Samoa'),
  ('iso3166', 'XK', 'Kosovo'),
  ('iso3166', 'YE', 'Yemen'),
  ('iso3166', 'YT', 'Mayotte'),
  ('iso3166', 'ZA', 'South Africa'),
  ('iso3166', 'ZM', 'Zambia'),
  ('iso3166', 'ZW', 'Zimbabwe'),
  ('group', 'EU27', 'European Union (27 countries, from 2020)'),
  ('group', 'EA20', 'Euro area (20 countries)'),
  ('group', 'EA21', 'Euro area (21 countries)'),
  ('group', 'EXTRA_EU27', 'All countries outside the European Union (27 countries)'),
  ('group', 'WORLD', 'All countries of the world'),
  ('group', 'OTHER', 'A partner that the source does not state')
ON CONFLICT (system, code) DO UPDATE SET label = EXCLUDED.label;

-- The codes of Eurostat that differ from the list. Any other code of two letters is the ISO code.
INSERT INTO area_code_source (codes, source_code, system, code) VALUES
  ('eurostat', 'EL', 'iso3166', 'GR'),
  ('eurostat', 'UK', 'iso3166', 'GB'),
  ('eurostat', 'EU27_2020', 'group', 'EU27'),
  ('eurostat', 'EA20', 'group', 'EA20'),
  ('eurostat', 'EA21', 'group', 'EA21'),
  ('eurostat', 'EXT_EU27_2020', 'group', 'EXTRA_EU27'),
  ('eurostat', 'TOTAL', 'group', 'WORLD'),
  ('eurostat', 'NSP', 'group', 'OTHER')
ON CONFLICT (codes, source_code) DO UPDATE SET system = EXCLUDED.system, code = EXCLUDED.code;


-- ============================================================================ entity_type ===
-- The first four words are the entity types of the committed fixture, which is SYNTHETIC.
-- `unknown` is mandatory: it is what lets a promotion complete when the extracted word is not a
-- live type, so a missing word never fails the pivotal step.
--
-- `military_unit` IS THE FIRST WORD OF THE REAL CORPUS. The v1 file holds 1010 military units,
-- 17 defence-industry organisations that are `company`, and 122 garrison places that are
-- `facility`, so those two words are reused and one is added. The arm of service — motorized
-- rifle, aviation, artillery, and 22 more spellings — is NOT a type: it is the `unit_type`
-- attribute, because a type list of 25 arms of service is a vocabulary that the data writes.
--
-- ITS TWO HUES HOLD THE BAND THE OTHER TYPES HOLD: 4.9:1 on the light page for colour_light,
-- and 8.5:1 on the dark page for colour_dark. The seeded hues are now blue, cyan, green, olive,
-- violet, amber, magenta, rust, plum and grey. The next type must have a new measured pair in the
-- same band.
-- >>> GENERATED entity_type
INSERT INTO entity_type (key, label, colour_light, colour_dark, ord) VALUES
  ('vessel',        'Vessel',        '#1e65aa', '#77b5fb',  10),
  ('facility',      'Facility',      '#007a69', '#3fcab7',  20),
  ('company',       'Company',       '#357426', '#87c47a',  30),
  ('person',        'Person',        '#983f6b', '#eb90b9',  40),
  ('military_unit', 'Military unit', '#a03f40', '#f4918e',  50),
  ('port',          'Port',          '#007491', '#3bc4e0',  60),
  ('bank',          'Bank',          '#825c00', '#d1ac4e',  70),
  ('state_body',    'State body',    '#5d55a9', '#a9a6fa',  75),
  ('legal_act',     'Legal act',     '#814893', '#d198e3',  80),
  ('event',         'Event',         '#b8470d', '#ee6018',  85),
  ('unknown',       'Unknown',       '#6b6562', '#8a8380', 900)
ON CONFLICT (key) DO UPDATE SET
  label        = EXCLUDED.label,
  colour_light = EXCLUDED.colour_light,
  colour_dark  = EXCLUDED.colour_dark,
  ord          = EXCLUDED.ord;
-- <<< GENERATED entity_type


-- ========================================================================== relation_type ===
-- One direction only: `owns` exists, and `owned_by` never does. `inverse_label` is how a page
-- reads the relation from its far end. `unknown` is mandatory, as it is for an entity: a word
-- that fits no live type lands there, and the word stays in `relations.proposed_type`.
--
-- THE UPDATE NAMES NO `retired`. A re-apply must never bring a retired word back into service.
-- `takes_interval` is written, and the trigger on this table refuses true to false while a dated
-- relation of the type stands, so a seed that drops an interval stops the apply with a reason.
-- >>> GENERATED relation_type
INSERT INTO relation_type (key, label, inverse_label, takes_interval) VALUES
  ('owns',               'owns',               'is owned by',                  true),
  ('operates',           'operates',           'is operated by',               true),
  ('flags',              'flags',              'is flagged by',                true),
  ('insures',            'insures',            'is insured by',                true),
  ('appoints',           'appoints',           'is appointed by',              true),
  ('designated_by',      'designated by',      'designates',                   true),
  ('restricted_by',      'restricted by',      'restricts',                    true),
  ('exempted_by',        'exempted by',        'exempts',                      true),
  ('issued_by',          'issued by',          'issues',                       false),
  ('charters',           'charters',           'is chartered by',              true),
  ('settles_through',    'settles through',    'is the settlement channel of', true),
  ('acts_for',           'acts for',           'has as agent',                 true),
  ('supplies_items_to',  'supplies items to',  'receives items from',          true),
  ('transfers_funds_to', 'transfers funds to', 'receives funds from',          true),
  ('pays_for',           'makes payments for', 'has payments made by',         true),
  ('supplies_crude_to',  'supplies crude to',  'receives crude from',          false),
  ('sells_products_to',  'sells products to',  'buys products from',           false),
  ('crude_flows_to',     'crude flows to',     'is fed crude by',              true),
  ('products_flow_to',   'products flow to',   'receives products from',       true),
  ('gas_flows_to',       'gas flows to',       'is fed gas by',                true),
  ('berthed_at',         'berthed at',         'is the berth of',              false),
  ('loads_at',           'loads at',           'is the loading place of',      false),
  ('discharges_at',      'discharges at',      'is the discharge place of',    false),
  ('sts_with',           'sts with',           'sts with',                     false),
  ('inspected_at',       'inspected at',       'is the inspection place of',   false),
  ('flagged_falsely',    'flagged falsely',    'is flagged falsely by',        false),
  ('contradicts',        'contradicts',        'is contradicted by',           false),
  ('occurred_at',        'occurred at',        'is the site of',               false),
  ('carried_out_by',     'carried out by',     'carries out',                  false),
  ('subordinate_to',     'subordinate to',     'is superior to',               false),
  ('associated_with',    'associated with',    'is associated with',           false),
  ('unknown',            'is linked to',       'is linked to',                 false)
ON CONFLICT (key) DO UPDATE SET
  label          = EXCLUDED.label,
  inverse_label  = EXCLUDED.inverse_label,
  takes_interval = EXCLUDED.takes_interval;
-- <<< GENERATED relation_type


-- ============================================================================== parameter ===
-- THE SEED WRITES A NUMBER AND NEVER REWRITES ONE. The whole point of the table is that the
-- operator changes a number in the live database, and an apply that restored the value below
-- would undo that change on the next routine run.
--
-- THE WAIT OF THE RUNNER IS A CHOICE AND NOT A MEASUREMENT. An empty queue is looked at every
-- thirty seconds, which is the longest the operator waits after queuing a document with the
-- runner idle.
--
-- THE RUN OF SHARED WORDS THAT MAKES TWO PASSAGES A COPY is a choice and not a measurement: eight
-- words in a row are rare in two texts that were written apart, and a quote of a few words is not
-- a copy. The operator tunes it from real data (ADR 0012).
INSERT INTO parameter (key, value) VALUES
  ('runner_empty_wait_seconds', 30),
  ('independence_shared_run_words', 8)
ON CONFLICT (key) DO NOTHING;

RESET ROLE;
