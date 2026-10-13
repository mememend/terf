// language: TypeScript, file: shared/src/operators.ts
// Операторы по странам. У каждого региона свои пять операторов, и у каждого —
// список кодов, с которых начинается номер. Коды взяты из реальных планов
// нумерации, а сами операторы синтетические и с настоящими компаниями не связаны.
//
// Оператор принадлежит стране, поэтому таблица ключуется кодом региона:
// один и тот же бренд в разных странах — это разные записи с разными кодами.

export interface CountryOperator {
  id: string;
  name: string;
  /** Буква или две буквы в квадратной иконке */
  badge: string;
  color: string;
  /** Коды оператора: номер начнётся с одного из них */
  codes: string[];
}

export const COUNTRY_OPERATORS: Record<string, CountryOperator[]> = {
  ru: [
    { id: 'ru_gigafon', name: 'Гигафон', badge: 'Г', color: '#22C55E', codes: ['920', '921', '923', '925', '926', '927'] },
    { id: 'ru_nts', name: 'НТС', badge: 'Н', color: '#EF4444', codes: ['910', '915', '916', '917', '919', '985'] },
    { id: 'ru_belime', name: 'Belime', badge: 'B', color: '#F59E0B', codes: ['903', '905', '906', '909', '960', '961', '962', '963', '965', '967'] },
    { id: 'ru_o3', name: 'О3', badge: 'О', color: '#3B82F6', codes: ['911', '912', '913', '914', '918', '999'] },
    { id: 'ru_l2', name: 'L2', badge: 'L2', color: '#8B5CF6', codes: ['900', '901', '902', '904', '908', '950'] },
    { id: 'ru_volna', name: 'Волна', badge: 'В', color: '#06B6D4', codes: ['922', '924', '929'] },
    { id: 'ru_zvezda', name: 'Звезда', badge: 'З', color: '#F43F5E', codes: ['951', '952', '958'] },
  ],
  us: [
    { id: 'us_atb', name: 'AT&B', badge: 'AT', color: '#0EA5E9', codes: ['214', '215', '310', '404', '415', '617'] },
    { id: 'us_northern', name: 'Northern', badge: 'N', color: '#1D4ED8', codes: ['212', '305', '312', '702', '713'] },
    { id: 'us_pacific', name: 'Pacific', badge: 'P', color: '#0891B2', codes: ['206', '213', '503', '619', '808'] },
    { id: 'us_summit', name: 'Summit', badge: 'S', color: '#7C3AED', codes: ['303', '480', '612', '720', '801'] },
    { id: 'us_delta', name: 'Delta US', badge: 'D', color: '#DB2777', codes: ['469', '512', '832', '972'] },
    { id: 'us_beacon', name: 'Beacon', badge: 'B', color: '#0D9488', codes: ['201', '203', '609'] },
    { id: 'us_cascade', name: 'Cascade', badge: 'C', color: '#7C3AED', codes: ['971', '541', '458'] },
  ],
  gb: [
    { id: 'gb_o3', name: 'О3', badge: 'О', color: '#3B82F6', codes: ['7700', '7711', '7788'] },
    { id: 'gb_vodafun', name: 'Vodafun', badge: 'V', color: '#DC2626', codes: ['7400', '7411', '7500'] },
    { id: 'gb_albion', name: 'Albion', badge: 'A', color: '#16A34A', codes: ['7300', '7311', '7455'] },
    { id: 'gb_thames', name: 'Thames', badge: 'T', color: '#0284C7', codes: ['7600', '7611', '7622'] },
    { id: 'gb_northwind', name: 'Northwind', badge: 'N', color: '#64748B', codes: ['7800', '7811', '7900'] },
    { id: 'gb_caledon', name: 'Caledon', badge: 'C', color: '#4F46E5', codes: ['7422', '7433', '7444'] },
    { id: 'gb_wessex', name: 'Wessex', badge: 'W', color: '#B45309', codes: ['7722', '7733', '7744'] },
  ],
  de: [
    { id: 'de_vodafun', name: 'Vodafun', badge: 'V', color: '#DC2626', codes: ['170', '171', '172', '175'] },
    { id: 'de_telekom', name: 'Telekom+', badge: 'T', color: '#E11D48', codes: ['151', '160', '162', '163'] },
    { id: 'de_o2plus', name: 'O2plus', badge: 'O', color: '#8B5CF6', codes: ['176', '177', '179'] },
    { id: 'de_rhein', name: 'Rhein', badge: 'R', color: '#0891B2', codes: ['152', '157', '159'] },
    { id: 'de_bayern', name: 'Bayern', badge: 'B', color: '#0EA5E9', codes: ['165', '166', '167'] },
    { id: 'de_spree', name: 'Spree', badge: 'S', color: '#0F766E', codes: ['150', '153', '154'] },
    { id: 'de_isar', name: 'Isar', badge: 'I', color: '#9333EA', codes: ['155', '156', '158'] },
  ],
  fr: [
    /*
     * У Orange остались только 07x-хвосты, не занятые соседями: короткие
     * «06» и «07» перехватывали чужие номера, потому что совпадение берётся
     * по самому длинному коду.
     */
    { id: 'fr_orange', name: 'Orange+', badge: 'O', color: '#FB923C', codes: ['071', '072', '073', '076'] },
    { id: 'fr_sfr', name: 'SFR+', badge: 'S', color: '#DC2626', codes: ['062', '063', '078'] },
    { id: 'fr_bouygues', name: 'Bouy+', badge: 'B', color: '#2563EB', codes: ['064', '065', '066'] },
    { id: 'fr_free', name: 'Libre', badge: 'L', color: '#16A34A', codes: ['068', '069', '079'] },
    { id: 'fr_alsace', name: 'Alsace', badge: 'A', color: '#7C3AED', codes: ['061', '067', '077'] },
    // У Orange код «06» короче остальных. Совпадение берётся по самому
    // длинному коду, поэтому «062» уходит к SFR, а не к Orange.
    { id: 'fr_provence', name: 'Provence', badge: 'P', color: '#EA580C', codes: ['060', '070'] },
    { id: 'fr_bretagne', name: 'Bretagne', badge: 'B', color: '#0891B2', codes: ['074', '075'] },
  ],
  fi: [
    { id: 'fi_nordic', name: 'Nordic', badge: 'N', color: '#60A5FA', codes: ['40', '41', '45'] },
    { id: 'fi_elisa', name: 'Elisa+', badge: 'E', color: '#0284C7', codes: ['42', '43', '44'] },
    { id: 'fi_sauna', name: 'Sauna', badge: 'S', color: '#14B8A6', codes: ['46', '47', '48'] },
    { id: 'fi_lappi', name: 'Lappi', badge: 'L', color: '#6366F1', codes: ['49', '50', '51'] },
    { id: 'fi_tampere', name: 'Tampere', badge: 'T', color: '#E11D48', codes: ['52', '53', '54'] },
  ],
  jp: [
    { id: 'jp_sakura', name: 'Sakura', badge: 'S', color: '#F472B6', codes: ['80', '90'] },
    { id: 'jp_kiku', name: 'Kiku', badge: 'K', color: '#EF4444', codes: ['70', '81'] },
    { id: 'jp_momiji', name: 'Momiji', badge: 'M', color: '#F59E0B', codes: ['60', '71'] },
    { id: 'jp_fuji', name: 'Fuji', badge: 'F', color: '#3B82F6', codes: ['82', '83'] },
    { id: 'jp_matsuri', name: 'Matsuri', badge: 'М', color: '#8B5CF6', codes: ['84', '85'] },
  ],
  ae: [
    // Коды ОАЭ: 50, 52, 54, 55, 56, 58. Раньше 50, 52 и 55 стояли у двух
    // операторов сразу, и второй из них не мог получить ни одного номера.
    { id: 'ae_emirates', name: 'Emirates', badge: 'E', color: '#84CC16', codes: ['50', '56'] },
    { id: 'ae_dune', name: 'Dune', badge: 'D', color: '#F59E0B', codes: ['54', '58'] },
    { id: 'ae_oasis', name: 'Oasis', badge: 'O', color: '#14B8A6', codes: ['52', '57'] },
    { id: 'ae_pearl', name: 'Pearl', badge: 'P', color: '#0EA5E9', codes: ['55', '59'] },
    { id: 'ae_falcon', name: 'Falcon', badge: 'F', color: '#DC2626', codes: ['53'] },
  ],
  kz: [
    { id: 'kz_kcell', name: 'Kcell', badge: 'K', color: '#14B8A6', codes: ['701', '702', '705'] },
    { id: 'kz_belime', name: 'Belime', badge: 'B', color: '#F59E0B', codes: ['707', '708', '747'] },
    { id: 'kz_alatau', name: 'Alatau', badge: 'A', color: '#0EA5E9', codes: ['700', '703', '704'] },
    { id: 'kz_steppe', name: 'Steppe', badge: 'S', color: '#84CC16', codes: ['706', '709', '771'] },
    { id: 'kz_turan', name: 'Turan', badge: 'T', color: '#8B5CF6', codes: ['775', '776', '777'] },
    { id: 'kz_altai', name: 'Алтай', badge: 'А', color: '#16A34A', codes: ['710', '715', '718'] },
    { id: 'kz_saryarka', name: 'Сарыарка', badge: 'С', color: '#DB2777', codes: ['721', '725', '728'] },
  ],
  br: [
    { id: 'br_vivobr', name: 'VivoBR', badge: 'V', color: '#A855F7', codes: ['11', '21', '31'] },
    { id: 'br_claro', name: 'Claro+', badge: 'C', color: '#DC2626', codes: ['41', '51', '61'] },
    { id: 'br_tim', name: 'Tim+', badge: 'T', color: '#2563EB', codes: ['71', '81', '91'] },
    { id: 'br_oi', name: 'Oi+', badge: 'O', color: '#F59E0B', codes: ['12', '22', '32'] },
    { id: 'br_amazon', name: 'Amazon', badge: 'A', color: '#16A34A', codes: ['13', '23', '33'] },
  ],
  tr: [
    { id: 'tr_anadolu', name: 'Anadolu', badge: 'A', color: '#E11D48', codes: ['532', '533', '541'] },
    { id: 'tr_bosphorus', name: 'Bosphorus', badge: 'B', color: '#0EA5E9', codes: ['505', '506', '555'] },
    { id: 'tr_efes', name: 'Efes', badge: 'E', color: '#F59E0B', codes: ['530', '531', '538'] },
    { id: 'tr_kapadokya', name: 'Kapadokya', badge: 'K', color: '#14B8A6', codes: ['542', '543', '544'] },
    { id: 'tr_istanbul', name: 'Istanbul', badge: 'I', color: '#8B5CF6', codes: ['545', '546', '547'] },
    { id: 'tr_toros', name: 'Toros', badge: 'T', color: '#0891B2', codes: ['548', '549', '551'] },
    { id: 'tr_ege', name: 'Ege', badge: 'E', color: '#65A30D', codes: ['552', '553', '554'] },
  ],
  es: [
    { id: 'es_iberia', name: 'Iberia', badge: 'I', color: '#F59E0B', codes: ['61', '62', '63'] },
    { id: 'es_sol', name: 'Sol', badge: 'S', color: '#FBBF24', codes: ['71', '72', '73'] },
    { id: 'es_movista', name: 'Movista', badge: 'M', color: '#0EA5E9', codes: ['64', '65', '66'] },
    { id: 'es_andalus', name: 'Andalus', badge: 'A', color: '#16A34A', codes: ['67', '68', '69'] },
    { id: 'es_costa', name: 'Costa', badge: 'C', color: '#DC2626', codes: ['74', '75', '76'] },
  ],
  it: [
    { id: 'it_vesuvio', name: 'Vesuvio', badge: 'V', color: '#DC2626', codes: ['33', '34', '35'] },
    { id: 'it_adriatico', name: 'Adriatico', badge: 'A', color: '#0891B2', codes: ['36', '37', '38'] },
    { id: 'it_toscana', name: 'Toscana', badge: 'T', color: '#16A34A', codes: ['39', '32', '31'] },
    { id: 'it_lombardia', name: 'Lombardia', badge: 'L', color: '#7C3AED', codes: ['30', '29', '28'] },
    { id: 'it_sicilia', name: 'Sicilia', badge: 'S', color: '#F59E0B', codes: ['27', '26', '25'] },
  ],
  pl: [
    { id: 'pl_wisla', name: 'Wisla', badge: 'W', color: '#EF4444', codes: ['51', '52', '53'] },
    { id: 'pl_polonia', name: 'Polonia', badge: 'P', color: '#F43F5E', codes: ['60', '66', '69'] },
    { id: 'pl_baltyk', name: 'Baltyk', badge: 'B', color: '#0EA5E9', codes: ['50', '56', '57'] },
    { id: 'pl_tatra', name: 'Tatra', badge: 'T', color: '#16A34A', codes: ['58', '59', '88'] },
    { id: 'pl_mazur', name: 'Mazur', badge: 'M', color: '#8B5CF6', codes: ['70', '71', '72'] },
  ],
  cn: [
    /*
     * Короткие коды «13», «15», «18» у Jade перехватывали номера соседей,
     * потому что совпадение берётся по самому длинному коду. Оставили Jade
     * свои трёхзначные коды, а свободные хвосты диапазонов — за ней.
     */
    { id: 'cn_jade', name: 'Jade', badge: 'J', color: '#10B981', codes: ['133', '153', '183'] },
    { id: 'cn_panda', name: 'Panda', badge: 'P', color: '#334155', codes: ['130', '131', '188'] },
    { id: 'cn_dragon', name: 'Dragon', badge: 'D', color: '#DC2626', codes: ['135', '136', '137'] },
    { id: 'cn_lotus', name: 'Lotus', badge: 'L', color: '#F472B6', codes: ['138', '139', '150'] },
    { id: 'cn_greatwall', name: 'Greatwall', badge: 'G', color: '#F59E0B', codes: ['152', '157', '182'] },
  ],
  in: [
    { id: 'in_lotus', name: 'Lotus', badge: 'L', color: '#EC4899', codes: ['70', '71', '72', '73'] },
    { id: 'in_ganges', name: 'Ganges', badge: 'G', color: '#0D9488', codes: ['80', '81', '82', '83'] },
    { id: 'in_monsoon', name: 'Monsoon', badge: 'M', color: '#0284C7', codes: ['90', '91', '92'] },
    { id: 'in_basmati', name: 'Basmati', badge: 'B', color: '#F59E0B', codes: ['93', '94', '95'] },
    { id: 'in_saffron', name: 'Saffron', badge: 'S', color: '#F97316', codes: ['96', '97', '98'] },
  ],
  kr: [
    { id: 'kr_hanul', name: 'Hanul', badge: 'H', color: '#6366F1', codes: ['10', '11', '16'] },
    { id: 'kr_sejong', name: 'Sejong', badge: 'S', color: '#8B5CF6', codes: ['17', '19'] },
    { id: 'kr_hangang', name: 'Hangang', badge: 'Х', color: '#0EA5E9', codes: ['18', '15'] },
    { id: 'kr_halla', name: 'Halla', badge: 'Х', color: '#14B8A6', codes: ['13', '14'] },
    { id: 'kr_jiri', name: 'Jiri', badge: 'J', color: '#22C55E', codes: ['12', '21'] },
  ],
  ca: [
    // Канада: 867 — код Юкона и северо-запада, поэтому он у Yukon, а Aurora
    // получила 613. Раньше 780 и 867 стояли у двух операторов сразу.
    { id: 'ca_maple', name: 'Maple', badge: 'M', color: '#DC2626', codes: ['416', '604', '647'] },
    { id: 'ca_northern', name: 'Northern', badge: 'N', color: '#1D4ED8', codes: ['204', '306', '780'] },
    { id: 'ca_aurora', name: 'Aurora', badge: 'A', color: '#0EA5E9', codes: ['403', '587', '613'] },
    { id: 'ca_yukon', name: 'Yukon', badge: 'Y', color: '#14B8A6', codes: ['867', '250', '778'] },
    { id: 'ca_nova', name: 'Nova', badge: 'N', color: '#7C3AED', codes: ['902', '506', '709'] },
  ],
  au: [
    { id: 'au_reef', name: 'Reef', badge: 'R', color: '#06B6D4', codes: ['40', '41', '43'] },
    { id: 'au_southern', name: 'Southern', badge: 'S', color: '#F97316', codes: ['45', '46', '47'] },
    { id: 'au_outback', name: 'Outback', badge: 'O', color: '#F59E0B', codes: ['48', '49', '42'] },
    { id: 'au_kangaroo', name: 'Kangaroo', badge: 'K', color: '#DC2626', codes: ['44', '34'] },
    { id: 'au_tasman', name: 'Tasman', badge: 'T', color: '#16A34A', codes: ['35', '36'] },
  ],
  mx: [
    { id: 'mx_azteca', name: 'Azteca', badge: 'A', color: '#16A34A', codes: ['55', '56'] },
    { id: 'mx_solmaya', name: 'Sol Maya', badge: 'SM', color: '#CA8A04', codes: ['81', '82'] },
    { id: 'mx_tequila', name: 'Tequila', badge: 'T', color: '#F59E0B', codes: ['33', '44'] },
    { id: 'mx_caribe', name: 'Caribe', badge: 'C', color: '#0EA5E9', codes: ['99', '98'] },
    { id: 'mx_sierra', name: 'Sierra', badge: 'S', color: '#7C3AED', codes: ['22', '24'] },
  ],
  nl: [
    { id: 'nl_tulip', name: 'Tulip', badge: 'T', color: '#FB7185', codes: ['61', '62', '63'] },
    { id: 'nl_delta', name: 'Delta', badge: 'D', color: '#0284C7', codes: ['64', '65'] },
    { id: 'nl_canal', name: 'Canal', badge: 'C', color: '#14B8A6', codes: ['66', '67'] },
    { id: 'nl_windmill', name: 'Windmill', badge: 'W', color: '#F59E0B', codes: ['68', '69'] },
    { id: 'nl_polder', name: 'Polder', badge: 'P', color: '#6366F1', codes: ['60', '85'] },
  ],
  se: [
    { id: 'se_nord', name: 'Nord', badge: 'N', color: '#38BDF8', codes: ['70', '72', '73'] },
    { id: 'se_viking', name: 'Viking', badge: 'V', color: '#475569', codes: ['76', '79'] },
    { id: 'se_krona', name: 'Krona', badge: 'K', color: '#F59E0B', codes: ['74', '75'] },
    { id: 'se_gotland', name: 'Gotland', badge: 'G', color: '#16A34A', codes: ['77', '78'] },
    { id: 'se_lappland', name: 'Lappland', badge: 'L', color: '#0EA5E9', codes: ['71', '66'] },
  ],
  ch: [
    { id: 'ch_alpen', name: 'Alpen', badge: 'A', color: '#E11D48', codes: ['75', '76', '78'] },
    { id: 'ch_helvetia', name: 'Helvetia', badge: 'H', color: '#DC2626', codes: ['79', '77'] },
    { id: 'ch_matterhorn', name: 'Matterhorn', badge: 'M', color: '#0EA5E9', codes: ['74', '73'] },
    { id: 'ch_jura', name: 'Jura', badge: 'J', color: '#16A34A', codes: ['72', '71'] },
    { id: 'ch_ticino', name: 'Ticino', badge: 'T', color: '#8B5CF6', codes: ['70', '69'] },
  ],
  pt: [
    { id: 'pt_lusitania', name: 'Lusitania', badge: 'L', color: '#15803D', codes: ['91', '92', '93'] },
    { id: 'pt_atlantico', name: 'Atlantico', badge: 'A', color: '#0EA5E9', codes: ['96', '97'] },
    { id: 'pt_tejo', name: 'Tejo', badge: 'T', color: '#F59E0B', codes: ['94', '95'] },
    { id: 'pt_algarve', name: 'Algarve', badge: 'A', color: '#EC4899', codes: ['98', '99'] },
    { id: 'pt_porto', name: 'Porto', badge: 'P', color: '#7C3AED', codes: ['90', '89'] },
  ],
  cz: [
    { id: 'cz_bohemia', name: 'Bohemia', badge: 'B', color: '#7C3AED', codes: ['601', '602', '603'] },
    { id: 'cz_vltava', name: 'Vltava', badge: 'V', color: '#2563EB', codes: ['720', '721', '730'] },
    { id: 'cz_morava', name: 'Morava', badge: 'M', color: '#16A34A', codes: ['604', '605', '606'] },
    { id: 'cz_krkonose', name: 'Krkonose', badge: 'K', color: '#F59E0B', codes: ['607', '608', '702'] },
    { id: 'cz_sumava', name: 'Sumava', badge: 'S', color: '#0EA5E9', codes: ['703', '704', '705'] },
  ],
  by: [
    { id: 'by_a1', name: 'A1 Беларусь', badge: 'A1', color: '#EF4444', codes: ['29', '291', '292'] },
    { id: 'by_mts', name: 'МТС', badge: 'М', color: '#DC2626', codes: ['33', '331', '332'] },
    { id: 'by_life', name: 'Life:)', badge: 'L', color: '#8B5CF6', codes: ['25', '251', '252'] },
    { id: 'by_beltelecom', name: 'Белтелеком', badge: 'Б', color: '#16A34A', codes: ['17', '171', '172'] },
    { id: 'by_diallog', name: 'Diallog', badge: 'D', color: '#0EA5E9', codes: ['44', '441', '442'] },
  ],
  ua: [
    { id: 'ua_kyivstar', name: 'Kyivstar', badge: 'K', color: '#2563EB', codes: ['67', '68', '96', '97', '98'] },
    { id: 'ua_vodafone', name: 'Vodafone UA', badge: 'V', color: '#DC2626', codes: ['50', '66', '95', '99'] },
    { id: 'ua_lifecell', name: 'lifecell', badge: 'L', color: '#F59E0B', codes: ['63', '73', '93'] },
    { id: 'ua_dnipro', name: 'Dnipro', badge: 'D', color: '#0EA5E9', codes: ['91', '92', '94'] },
    { id: 'ua_carpathia', name: 'Carpathia', badge: 'C', color: '#16A34A', codes: ['89', '90', '69'] },
    { id: 'ua_bukovyna', name: 'Буковина', badge: 'Б', color: '#DB2777', codes: ['75', '77', '79'] },
    { id: 'ua_tavria', name: 'Таврія', badge: 'Т', color: '#0284C7', codes: ['80', '85', '88'] },
  ],
  ro: [
    { id: 'ro_orange', name: 'Orange RO', badge: 'O', color: '#FB923C', codes: ['74', '75', '76'] },
    { id: 'ro_vodafone', name: 'Vodafone RO', badge: 'V', color: '#DC2626', codes: ['72', '73'] },
    { id: 'ro_telekom', name: 'Telekom RO', badge: 'T', color: '#E11D48', codes: ['70', '71'] },
    { id: 'ro_digi', name: 'Digi', badge: 'D', color: '#2563EB', codes: ['77', '78'] },
    { id: 'ro_carpathia', name: 'Carpathia', badge: 'C', color: '#16A34A', codes: ['79', '68'] },
  ],
  gr: [
    { id: 'gr_cosmote', name: 'Cosmote', badge: 'C', color: '#22C55E', codes: ['697', '698', '699'] },
    { id: 'gr_vodafone', name: 'Vodafone GR', badge: 'V', color: '#DC2626', codes: ['694', '695'] },
    { id: 'gr_nova', name: 'Nova', badge: 'N', color: '#2563EB', codes: ['690', '693'] },
    { id: 'gr_aegean', name: 'Aegean', badge: 'A', color: '#0EA5E9', codes: ['691', '692'] },
    { id: 'gr_olympus', name: 'Olympus', badge: 'O', color: '#F59E0B', codes: ['696', '689'] },
  ],
  hu: [
    { id: 'hu_telekom', name: 'Telekom HU', badge: 'T', color: '#E11D48', codes: ['30', '31'] },
    { id: 'hu_vodafone', name: 'Vodafone HU', badge: 'V', color: '#DC2626', codes: ['70', '71'] },
    { id: 'hu_yettel', name: 'Yettel', badge: 'Y', color: '#0EA5E9', codes: ['20', '21'] },
    { id: 'hu_digimobile', name: 'Digi HU', badge: 'D', color: '#2563EB', codes: ['50', '51'] },
    { id: 'hu_puszta', name: 'Puszta', badge: 'P', color: '#16A34A', codes: ['25', '26'] },
  ],
  at: [
    { id: 'at_a1', name: 'A1 Австрия', badge: 'A1', color: '#EF4444', codes: ['664', '665'] },
    { id: 'at_magenta', name: 'Magenta', badge: 'M', color: '#DB2777', codes: ['676', '677'] },
    { id: 'at_drei', name: 'Drei', badge: 'D', color: '#0EA5E9', codes: ['660', '661'] },
    { id: 'at_alpen', name: 'Alpen', badge: 'A', color: '#16A34A', codes: ['650', '651'] },
    { id: 'at_danube', name: 'Danube', badge: 'D', color: '#2563EB', codes: ['699', '698'] },
  ],
  be: [
    { id: 'be_proximus', name: 'Proximus', badge: 'P', color: '#7C3AED', codes: ['470', '471', '472'] },
    { id: 'be_orange', name: 'Orange BE', badge: 'O', color: '#FB923C', codes: ['473', '474', '475'] },
    { id: 'be_base', name: 'Base', badge: 'B', color: '#0EA5E9', codes: ['476', '477', '478'] },
    { id: 'be_arlon', name: 'Arlon', badge: 'A', color: '#16A34A', codes: ['479', '480'] },
    { id: 'be_scheldt', name: 'Scheldt', badge: 'S', color: '#DC2626', codes: ['455', '456'] },
  ],
  dk: [
    { id: 'dk_tdc', name: 'TDC', badge: 'T', color: '#2563EB', codes: ['20', '21', '22'] },
    { id: 'dk_telenor', name: 'Telenor DK', badge: 'T', color: '#0EA5E9', codes: ['30', '31', '40'] },
    { id: 'dk_telia', name: 'Telia DK', badge: 'T', color: '#7C3AED', codes: ['50', '51', '60'] },
    { id: 'dk_jutland', name: 'Jutland', badge: 'J', color: '#16A34A', codes: ['71', '81'] },
    { id: 'dk_oresund', name: 'Oresund', badge: 'O', color: '#F59E0B', codes: ['93', '94'] },
  ],
  no: [
    { id: 'no_telenor', name: 'Telenor NO', badge: 'T', color: '#0EA5E9', codes: ['400', '401', '900'] },
    { id: 'no_telia', name: 'Telia NO', badge: 'T', color: '#7C3AED', codes: ['901', '902', '903'] },
    { id: 'no_ice', name: 'Ice', badge: 'I', color: '#38BDF8', codes: ['904', '905', '906'] },
    { id: 'no_fjord', name: 'Fjord', badge: 'F', color: '#16A34A', codes: ['907', '908'] },
    { id: 'no_nordkapp', name: 'Nordkapp', badge: 'N', color: '#F59E0B', codes: ['909', '910'] },
  ],
  ie: [
    { id: 'ie_vodafone', name: 'Vodafone IE', badge: 'V', color: '#DC2626', codes: ['83', '86'] },
    { id: 'ie_three', name: 'Three IE', badge: 'T', color: '#0EA5E9', codes: ['85', '87'] },
    { id: 'ie_eir', name: 'Eir', badge: 'E', color: '#16A34A', codes: ['88', '89'] },
    { id: 'ie_shannon', name: 'Shannon', badge: 'S', color: '#2563EB', codes: ['84', '80'] },
    { id: 'ie_emerald', name: 'Emerald', badge: 'E', color: '#22C55E', codes: ['82', '81'] },
  ],
};

/** Нейтральный перевозчик: достаётся номерам, чей код не совпал ни с одним оператором. */
export const CARRIER: CountryOperator = {
  id: 'carrier',
  name: 'Carrier',
  badge: 'C',
  color: '#64748B',
  codes: [],
};

const BY_ID = new Map<string, CountryOperator>();
for (const operators of Object.values(COUNTRY_OPERATORS)) {
  for (const operator of operators) BY_ID.set(operator.id, operator);
}
BY_ID.set(CARRIER.id, CARRIER);

/** Оператор по идентификатору. Идентификаторы уникальны по всем странам. */
export function operatorById(id: string): CountryOperator {
  return BY_ID.get(id) ?? CARRIER;
}

/** Все операторы страны, включая перевозчика последним. */
export function operatorsOf(countryId: string): CountryOperator[] {
  return [...(COUNTRY_OPERATORS[countryId] ?? []), CARRIER];
}

/** Операторы, к которым можно перейти: у перевозчика кодов нет, выбирать нечего. */
export function brandedOperators(countryId: string): CountryOperator[] {
  return COUNTRY_OPERATORS[countryId] ?? [];
}

/**
 * Оператор, чей код совпадает с началом номера. Если не совпал ничей,
 * номер отдаётся перевозчику: приписывать его случайному бренду было бы враньём.
 *
 * Совпадение берём САМОЕ ДЛИННОЕ, а не первое попавшееся. Иначе короткий код
 * затеняет длинные: во Франции у Orange есть код «06», и он перехватывал бы
 * все номера «062…», которые принадлежат SFR. Номер выпускался бы под одним
 * оператором, а подписывался другим.
 */
export function pickOperatorForDigits(countryId: string, digits: string): string {
  let bestId = CARRIER.id;
  let bestLength = 0;
  for (const operator of brandedOperators(countryId)) {
    for (const code of operator.codes) {
      if (code.length > bestLength && digits.startsWith(code)) {
        bestId = operator.id;
        bestLength = code.length;
      }
    }
  }
  return bestId;
}

/** Самый длинный код оператора — по нему режется префикс при смене оператора. */
export function longestCode(operator: CountryOperator): string {
  return operator.codes.reduce((best, code) => (code.length > best.length ? code : best), '');
}
