import type { MappingDraft } from '@gab/proposal/mapping';

/** A recipe is the mapping of a table that code knows by its address and its header, so no model
 * reads it and no credit is spent. A reviewer decides the mapping as any other. A recipe
 * answers only for the exact header that it lists: a change of the source falls through to the
 * model, and never to a guess. */
export const RECIPE_AGENT = { name: 'deterministic_mapper', version: 'v1' } as const;

const CREA_HOST = 'api.russiafossiltracker.com';
const CREA = 'Centre for Research on Energy and Clean Air';

const PORT_HEADER = [
  'origin_name',
  'origin_port_name',
  'origin_zone_name',
  'origin_iso2',
  'origin_country',
  'origin_region',
  'origin_area',
  'commodity_origin_iso2',
  'commodity_origin_country',
  'commodity_origin_region',
  'pricing_scenario',
  'value_tonne',
  'value_m3',
  'value_gas_m3',
  'trade_count',
  'avg_vessel_age',
  'avg_n_inspections_2y',
  'avg_deficiencies_per_inspection_2y',
  'avg_detentions_per_inspection_2y',
  'avg_n_detentions_2y',
  'value_eur',
  'value_usd',
  'departure_date',
];

const COUNTER_HEADER = [
  'destination_iso2',
  'destination_country',
  'destination_region',
  'destination_regions',
  'commodity',
  'commodity_group',
  'commodity_group_name',
  'year',
  'pricing_scenario',
  'pricing_scenario_name',
  'version',
  'value_tonne',
  'value_eur',
  'value_usd',
];

// The UN/LOCODE of the port that the record holds for each name of the tracker. The list is part
// of the mapping, so the reviewer reads it. A name that is not here has no port in the record, and
// its rows go to the load report. The tracker names the Kozmino terminal "Nakhodka" for crude, and
// "Nakhodka" for products is the Port of Nakhodka.
const PORTS: Readonly<Record<string, string>> = {
  Arkhangelsk: 'RUARH',
  Azov: 'RUAZO',
  'De Kastri': 'RUDKA',
  Kavkaz: 'RUKZP',
  Murmansk: 'RUMMK',
  Novorossiysk: 'RUNVS',
  Primorsk: 'RUPRI',
  'Sabetta Seaport': 'RUSAB',
  'St Petersburg': 'RULED',
  Taman: 'RUTAM',
  'Ust Luga': 'RUULU',
  Vanino: 'RUVNN',
  Vladivostok: 'RUVVO',
  'Vostochny Port': 'RUVYP',
  Vysotsk: 'RUVYS',
};
const PORT_NAKHODKA = { ...PORTS, Nakhodka: 'RUNJK' };
const PORT_KOZMINO = { ...PORTS, Nakhodka: 'RUKZM' };

const MEASURE_OF_PORT: Readonly<Record<string, string>> = {
  crude_oil: 'crude_oil_departures',
  oil_products: 'oil_products_departures',
};

const MEASURE_OF_COUNTER: Readonly<Record<string, string>> = {
  crude_oil: 'russian_crude_oil_by_sea_exports',
  pipeline_oil: 'russian_crude_oil_by_pipeline_exports',
  oil_products: 'russian_oil_products_by_sea_exports',
  oil_products_pipeline: 'russian_oil_products_by_pipeline_exports',
  lng: 'russian_lng_exports',
  natural_gas: 'russian_pipeline_gas_exports',
};

const EUROSTAT_HOST = 'ec.europa.eu';
const EUROSTAT_DATA = '/eurostat/api/dissemination/sdmx/2.1/data/';

// The annual tables of the imports by partner, as the SDMX-CSV answer of the Eurostat API gives
// them: one row for each reporter, product, unit and year.
const EUROSTAT_HEADER = [
  'DATAFLOW',
  'LAST UPDATE',
  'freq',
  'siec',
  'partner',
  'unit',
  'geo',
  'TIME_PERIOD',
  'OBS_VALUE',
  'OBS_FLAG',
  'CONF_STATUS',
];

// The oil table holds other products under other codes, so the measure of crude names its code.
// O4100_TOT is crude oil alone: the composite O4100_TOT_4200-4500 adds NGL, feedstocks and additives.
const MEASURE_OF_EUROSTAT: Readonly<Record<string, { measure: string; key: string }>> = {
  nrg_ti_gas: { measure: 'imports_natural_gas', key: '.G3000.' },
  nrg_ti_oil: { measure: 'imports_crude_oil', key: '.O4100_TOT.' },
};

const COMTRADE_HOST = 'comtradeapi.un.org';
const COMTRADE_PATH = /^\/data\/v1\/get\/C\/([AM])\/HS$/u;

// The columns of the answer that the tool comtrade_data stores. A change of the answer falls
// through to the model.
const COMTRADE_HEADER = (
  'typeCode,freqCode,refPeriodId,refYear,refMonth,period,reporterCode,reporterISO,reporterDesc,' +
  'flowCode,flowDesc,partnerCode,partnerISO,partnerDesc,partner2Code,partner2ISO,partner2Desc,' +
  'classificationCode,classificationSearchCode,isOriginalClassification,cmdCode,cmdDesc,aggrLevel,' +
  'isLeaf,customsCode,customsDesc,mosCode,motCode,motDesc,qtyUnitCode,qtyUnitAbbr,qty,' +
  'isQtyEstimated,altQtyUnitCode,altQtyUnitAbbr,altQty,isAltQtyEstimated,netWgt,' +
  'isNetWgtEstimated,grossWgt,isGrossWgtEstimated,cifvalue,fobvalue,primaryValue,' +
  'legacyEstimationFlag,isReported,isAggregate'
).split(',');

// The flow is in the stored address, not in a column that the mapping can read, so each flow has
// its own measure.
const COMTRADE_FLOW: Readonly<Record<string, { measure: string; method: string }>> = {
  X: { measure: 'exports', method: 'exports reported by the exporter' },
  M: { measure: 'imports', method: 'imports reported by the importer' },
};

const same = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && a.every((name, at) => name === b[at]);

/** The mapping of a table that a recipe knows, or undefined. The address is the one that the
 * document was fetched from. */
export const recipeOf = (
  address: string | null,
  header: readonly string[],
): MappingDraft | undefined => {
  if (address === null) return undefined;
  let url: URL;
  try {
    url = new URL(address);
  } catch {
    return undefined;
  }
  if (url.hostname === EUROSTAT_HOST) {
    const dataset = url.pathname.startsWith(EUROSTAT_DATA)
      ? url.pathname.slice(EUROSTAT_DATA.length).split('/')[0]
      : undefined;
    const held = MEASURE_OF_EUROSTAT[dataset ?? ''];
    if (held === undefined || !url.pathname.includes(held.key) || !same(header, EUROSTAT_HEADER))
      return undefined;
    const { measure } = held;
    return {
      table: dataset ?? '',
      modality: 'asserts',
      publisher: 'Eurostat',
      rows: {
        measure,
        value: { column: 'OBS_VALUE' },
        unit: { column: 'unit' },
        period: { column: 'TIME_PERIOD', length: 'year' },
        reporter: { column: 'geo', codes: 'eurostat' },
        partner: { column: 'partner', codes: 'eurostat' },
        product: { column: 'siec', system: 'siec' },
        method:
          'imports reported by the importer; a row of a group (EU27, EA21) is the total of its member states',
        flag: 'OBS_FLAG',
      },
      relations: [],
    };
  }
  if (url.hostname === COMTRADE_HOST) {
    const frequency = COMTRADE_PATH.exec(url.pathname)?.[1];
    const flow = COMTRADE_FLOW[url.searchParams.get('flowCode') ?? ''];
    // A table without the total filters holds a row for each breakdown, so it is not mapped.
    const total = ['customsCode=C00', 'motCode=0', 'partner2Code=0'].every((one) =>
      url.search.includes(one),
    );
    if (frequency === undefined || flow === undefined || !total || !same(header, COMTRADE_HEADER))
      return undefined;
    return {
      table: 'comtrade',
      modality: 'asserts',
      publisher: 'UN Comtrade',
      rows: {
        measure: flow.measure,
        value: { column: 'primaryValue' },
        unit: { constant: 'usd' },
        period: { column: 'period', length: frequency === 'A' ? 'year' : 'month' },
        reporter: { column: 'reporterCode', codes: 'm49' },
        partner: { column: 'partnerCode', codes: 'm49' },
        product: { column: 'cmdCode', system: 'hs' },
        method: flow.method,
        flag: 'legacyEstimationFlag',
      },
      relations: [],
    };
  }
  if (url.hostname !== CREA_HOST) return undefined;
  const commodity = url.searchParams.get('commodity') ?? '';

  if (url.pathname === '/v0/chart/departure_by_port' && same(header, PORT_HEADER)) {
    const measure = MEASURE_OF_PORT[commodity];
    if (measure === undefined) return undefined;
    return {
      table: `crea_departures_by_port_${commodity}`,
      modality: 'asserts',
      publisher: CREA,
      rows: {
        measure,
        value: { column: 'value_tonne' },
        unit: { constant: 'tonne' },
        period: { column: 'departure_date', length: 'day' },
        // The origin of the commodity, so that a cargo of another country is another figure.
        reporter: { column: 'commodity_origin_iso2', codes: 'iso3166' },
        subject: {
          entity_type: 'port',
          name: 'origin_port_name',
          lookup: [{ key: 'unlocode', column: 'origin_port_name' }],
          translate: commodity === 'crude_oil' ? PORT_KOZMINO : PORT_NAKHODKA,
        },
        method: 'departures of vessels from the port, estimated by the publisher',
      },
      relations: [],
    };
  }

  if (
    url.pathname === '/v0/counter' &&
    url.searchParams.get('aggregate_by') === 'destination_country,commodity,year' &&
    same(header, COUNTER_HEADER)
  ) {
    const measure = MEASURE_OF_COUNTER[commodity];
    if (measure === undefined) return undefined;
    return {
      table: `crea_exports_by_buyer_${commodity}`,
      modality: 'asserts',
      publisher: CREA,
      rows: {
        measure,
        value: { column: 'value_tonne' },
        unit: { constant: 'tonne' },
        period: { column: 'year', length: 'year' },
        partner: { column: 'destination_iso2', codes: 'iso3166' },
        method: 'exports from Russia to the buyer country, estimated by the publisher',
      },
      relations: [],
    };
  }
  return undefined;
};
