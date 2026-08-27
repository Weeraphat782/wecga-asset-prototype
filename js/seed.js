/* =====================================================================
   Seed data. No database - this is the single in-memory store.
   Mutations persist for the browser session so demo flows advance.

   ASSET SHAPE (SAP fields kept verbatim from page 11 of the requirements,
   plus WeCGA extension fields). View authors: read these keys.
   ---------------------------------------------------------------------
   SAP fields:  company assetClass assetClassDesc municipality asset sno
                capDate desc1 desc2 costCenter serial quantity baseUnit
                cost accum nbv costCenterName location locationDesc room
                eva4 eva4Desc evGrp5 eva5Desc wbs vendor vendorName
                manufacturer usefulLifePeriod usefulLifeYear trPrt typeName warranty
   WeCGA ext:   id companyCode source wecgaCode owner(={type,name,email})
                orgName orgHeadEmail brand model carNumber lat lng address
                district province ageOfAsset tagStatus photos[] countStatus
                lastCountDate
   source: 'SAP' | 'WeCGA' | 'reregistered'
   tagStatus: 'Tagged' | 'Not tagged'
   countStatus: 'Found' | 'Not found' | 'Not counted'
   ===================================================================== */

(function () {
  const iso = (y, m, d, h, mi) => new Date(y, m - 1, d, h || 9, mi || 0).toISOString();

  const users = [
    { id: 'U-001', name: 'Somchai Asset (HQ)', role: 'asset_hq', email: 'somchai.a@wecga.co.th', org: 'Asset Management HQ', company: 'AIS' },
    { id: 'U-002', name: 'Nadia GA-BKK', role: 'ga', email: 'nadia.g@wecga.co.th', org: 'GA Bangkok', company: 'AIS', area: 'HQ Bangkok' },
    { id: 'U-003', name: 'Preecha Accounting', role: 'accounting', email: 'preecha.acc@wecga.co.th', org: 'Accounting', company: 'AIS' },
    { id: 'U-004', name: 'Wanida Employee', role: 'employee', email: 'wanida.e@wecga.co.th', org: 'Cloud Implementation', company: 'AIS' },
    { id: 'U-005', name: 'Kittipong IT', role: 'it', email: 'kittipong.it@wecga.co.th', org: 'IT Infrastructure', company: 'AIS' },
    { id: 'U-006', name: 'Arthit Network Eng.', role: 'engineer', email: 'arthit.eng@wecga.co.th', org: 'Network Engineering', company: 'AIS' },
    { id: 'U-007', name: 'Malee Store', role: 'store', email: 'malee.store@wecga.co.th', org: 'Central Store', company: 'AIS' },
    { id: 'U-008', name: 'Committee Chair', role: 'committee', email: 'committee@wecga.co.th', org: 'Disposal Committee', company: 'AIS' },
    { id: 'U-009', name: 'Executive Viewer', role: 'exec', email: 'exec@wecga.co.th', org: 'Executive', company: 'AIS' },
    { id: 'U-010', name: 'Chalpermsak GA-North', role: 'ga', email: 'chalermsak.g@wecga.co.th', org: 'GA North', company: 'AIS', area: 'North Field' },
    { id: 'U-011', name: 'Suda Employee (BB)', role: 'employee', email: 'suda.e@bb.co.th', org: 'Field Ops', company: 'BB' },
  ];

  // Site hierarchy leaf units (Company → Project → Building → Floor → Unit)
  const sites = [
    { company: 'AIS', project: 'HQ Bangkok', building: 'HQ Tower', floor: '9F', unit: '9F-IT' },
    { company: 'AIS', project: 'HQ Bangkok', building: 'HQ Tower', floor: '8F', unit: '8F-Exec' },
    { company: 'AIS', project: 'HQ Bangkok', building: 'HQ Tower', floor: '8F', unit: '8F-Finance' },
    { company: 'AIS', project: 'HQ Bangkok', building: 'HQ Tower', floor: '5F', unit: '5F-A' },
    { company: 'AIS', project: 'HQ Bangkok', building: 'HQ Tower', floor: '5F', unit: '5F-MR1' },
    { company: 'AIS', project: 'HQ Bangkok', building: 'HQ Tower', floor: '5F', unit: '5F-MR2' },
    { company: 'AIS', project: 'HQ Bangkok', building: 'HQ Tower', floor: '5F', unit: '5F-Store' },
    { company: 'AIS', project: 'HQ Bangkok', building: 'HQ Tower', floor: '10F', unit: '10F-Lab' },
    { company: 'AIS', project: 'HQ Bangkok', building: 'HQ Tower', floor: 'G', unit: 'G-Lobby' },
    { company: 'AIS', project: 'HQ Bangkok', building: 'HQ Tower', floor: 'G', unit: 'G-Loading' },
    { company: 'AIS', project: 'HQ Bangkok', building: 'Cyber World', floor: 'BF', unit: 'BF001' },
    { company: 'AIS', project: 'HQ Bangkok', building: 'Cyber World', floor: 'BF', unit: 'BF002' },
    { company: 'AIS', project: 'HQ Bangkok', building: 'Cyber World', floor: 'BF', unit: 'BF003' },
    { company: 'AIS', project: 'HQ Bangkok', building: 'AIS One', floor: '12F', unit: '12F-NOC' },
    { company: 'AIS', project: 'HQ Bangkok', building: 'AIS One', floor: '15F', unit: '15F-Meeting' },
    { company: 'AIS', project: 'North Field', building: 'CNX Depot', floor: 'G', unit: 'Yard' },
    { company: 'AIS', project: 'North Field', building: 'CNX Depot', floor: '1F', unit: '1F-Store' },
    { company: 'AIS', project: 'Central Region', building: 'Korat Branch', floor: 'G', unit: 'Office' },
    { company: 'AIS', project: 'Central Region', building: 'Korat Branch', floor: 'G', unit: 'G-Warehouse' },
    { company: 'AIS', project: 'Central Region', building: 'Korat Branch', floor: '1F', unit: '1F-Office' },
    { company: 'AIS', project: 'Northeast Region', building: 'KKN Branch', floor: 'G', unit: 'Office' },
    { company: 'AIS', project: 'Northeast Region', building: 'KKN Branch', floor: 'G', unit: 'G-Warehouse' },
    { company: 'AIS', project: 'Northeast Region', building: 'KKN Branch', floor: '1F', unit: '1F-Office' },
    { company: 'AIS', project: 'East Region', building: 'CBI Branch', floor: 'G', unit: 'Office' },
    { company: 'AIS', project: 'East Region', building: 'CBI Branch', floor: 'G', unit: 'G-Warehouse' },
    { company: 'AIS', project: 'East Region', building: 'CBI Branch', floor: '1F', unit: '1F-Office' },
    { company: 'AIS', project: 'South Region', building: 'HKT Branch', floor: 'G', unit: 'Office' },
    { company: 'AIS', project: 'South Region', building: 'HKT Branch', floor: 'G', unit: 'G-Warehouse' },
    { company: 'AIS', project: 'South Region', building: 'HKT Branch', floor: '1F', unit: '1F-Office' },
    { company: 'BB', project: 'BB Bangkok', building: 'BB Office', floor: '2F', unit: '2F' },
    { company: 'BB', project: 'BB Nonthaburi', building: 'BB Node', floor: 'G', unit: 'Node' },
    { company: 'BB', project: 'BB Chiang Mai', building: 'CNX Node A', floor: 'G', unit: 'Node' },
    { company: 'BB', project: 'BB Phuket', building: 'HKT Node B', floor: 'G', unit: 'Node' },
  ];

  function locFor(area, room, locationDesc, companyCode) {
    const cc = companyCode || 'AIS';
    const cyber = locationDesc && /CBW_Cyber|Cyber/i.test(locationDesc);
    if (cc === 'BB') {
      if (area === 'BB01' || area === 'BB Bangkok') return { company: 'BB', project: 'BB Bangkok', building: 'BB Office', floor: '2F', unit: '2F' };
      if (area === 'BB02') return { company: 'BB', project: 'BB Nonthaburi', building: 'BB Node', floor: 'G', unit: 'Node' };
      if (area === 'BB03') return { company: 'BB', project: 'BB Chiang Mai', building: 'CNX Node A', floor: 'G', unit: 'Node' };
      return { company: 'BB', project: 'BB Bangkok', building: 'BB Office', floor: '2F', unit: '2F' };
    }
    if (area === 'NORTH' || area === 'North Field') return { company: 'AIS', project: 'North Field', building: 'CNX Depot', floor: 'G', unit: 'Yard' };
    if (area === 'CENTRAL') return { company: 'AIS', project: 'Central Region', building: 'Korat Branch', floor: 'G', unit: 'Office' };
    if (area === 'NORTHEAST') return { company: 'AIS', project: 'Northeast Region', building: 'KKN Branch', floor: 'G', unit: 'Office' };
    if (area === 'EAST') return { company: 'AIS', project: 'East Region', building: 'CBI Branch', floor: 'G', unit: 'Office' };
    if (area === 'SOUTH') return { company: 'AIS', project: 'South Region', building: 'HKT Branch', floor: 'G', unit: 'Office' };
    if (cyber || room === 'BF002') return { company: 'AIS', project: 'HQ Bangkok', building: 'Cyber World', floor: 'BF', unit: 'BF002' };
    if (room === 'BF001') return { company: 'AIS', project: 'HQ Bangkok', building: 'Cyber World', floor: 'BF', unit: 'BF001' };
    if (room && room.startsWith('G-')) return { company: cc, project: 'HQ Bangkok', building: 'HQ Tower', floor: 'G', unit: room };
    const hq = { '9F-IT': '9F-IT', '5F-A': '5F-A', '5F-MR1': '5F-MR1', '5F-MR2': '5F-MR2', '5F-Store': '5F-Store', '8F-Exec': '8F-Exec', '10F-Lab': '10F-Lab', '2F': '2F' };
    if (room && hq[room]) {
      const floor = room.startsWith('9F') ? '9F' : room.startsWith('5F') ? '5F' : room.startsWith('8F') ? '8F' : room.startsWith('10F') ? '10F' : room;
      const building = room === '2F' ? 'BB Office' : 'HQ Tower';
      const project = room === '2F' ? 'BB Bangkok' : 'HQ Bangkok';
      return { company: cc, project, building, floor, unit: hq[room] };
    }
    return { company: 'AIS', project: 'HQ Bangkok', building: 'HQ Tower', floor: '9F', unit: '9F-IT' };
  }

  function applyLoc(a) {
    const loc = locFor(a.area, a.room, a.locationDesc, a.companyCode);
    Object.assign(a, loc);
    a.area = loc.project;
  }

  // Base defaults matching the page-11 SAP example, overridden per asset.
  const base = {
    company: '2900', assetClass: '7150', assetClassDesc: 'Data Network Equip.',
    sno: '0', quantity: 1, baseUnit: 'EA', wbs: '', manufacturer: '',
    usefulLifePeriod: '', trPrt: '', typeName: '', warranty: '',
    room: '', eva4: '', eva4Desc: '', evGrp5: '', eva5Desc: '',
    companyCode: 'AIS', source: 'SAP', tagStatus: 'Tagged',
    countStatus: 'Not counted', photos: [],
    locationBasis: 'SAP', po: 'PO-4500091231',
  };

  function mkPhotos(lat, lng, district, province) {
    const ts = iso(2026, 1, 20, 10, 15);
    return ['Whole asset', 'QR code', 'Serial number'].map(t => ({ type: t, lat, lng, district, province, ts }));
  }

  const A = (o) => Object.assign({}, base, o);

  const assets = [
    // 1 - the exact page-11 example record
    A({ id: 'A-001', asset: '715000017728', municipality: '000033031810-0000',
      capDate: iso(2021, 2, 10), desc1: 'Switch H3C', desc2: 'Ports and 6',
      costCenter: '29022005', costCenterName: 'Cloud Implementation',
      serial: '*235A2ABH209000035', cost: 176000, accum: -175132.06, nbv: 867.94,
      location: '110610300N', locationDesc: 'ABC_BKK_BKK_CBW_Cyber', room: 'BF002',
      eva4: 'DN16', eva4Desc: 'Router and Switch', evGrp5: 'CSLENT23', eva5Desc: 'Cloud Computing Services',
      vendor: '6100003903', vendorName: '\u0e1a\u0e08. ABC', usefulLifeYear: 5,
      brand: 'H3C', model: 'S5130', ageOfAsset: '5y',
      owner: { type: 'org', name: 'Cloud Implementation', email: 'headof.cloud@wecga.co.th' },
      orgName: 'Cloud Implementation', orgHeadEmail: 'headof.cloud@wecga.co.th',
      lat: 13.7466, lng: 100.5347, address: 'Cyber World Tower', district: 'Huai Khwang', province: 'Bangkok',
      warranty: 'Expired 2024', tagStatus: 'Tagged', countStatus: 'Found', lastCountDate: iso(2026, 1, 20),
      photos: mkPhotos(13.7466, 100.5347, 'Huai Khwang', 'Bangkok'), area: 'BKK' }),
    // 2 - laptop, IT, tagged, found
    A({ id: 'A-002', asset: '715000018001', municipality: '000033040110-0000', assetClass: '7200', assetClassDesc: 'IT Equipment',
      capDate: iso(2023, 6, 15), desc1: 'Notebook Dell Latitude', desc2: '5440 i7',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'DLL5440X0091',
      cost: 42000, accum: -21000, nbv: 21000, location: '110610100N', locationDesc: 'ABC_BKK_HQ_9F', room: '9F-IT',
      vendor: '6100004410', vendorName: '\u0e1a\u0e08. Dell TH', usefulLifeYear: 4, brand: 'Dell', model: 'Latitude 5440',
      owner: { type: 'person', name: 'Kittipong IT', email: 'kittipong.it@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, address: 'HQ Building', district: 'Pathum Wan', province: 'Bangkok',
      locationBasis: 'employee', warranty: '2027-06', tagStatus: 'Tagged', countStatus: 'Found', lastCountDate: iso(2026, 1, 21), area: 'BKK' }),
    // 3 - office chair, furniture, org owner
    A({ id: 'A-003', asset: '715000018220', municipality: '000033041220-0000', assetClass: '7050', assetClassDesc: 'Furniture & Fixtures',
      capDate: iso(2022, 3, 1), desc1: 'Ergonomic Chair', desc2: 'Herman Miller',
      costCenter: '29013300', costCenterName: 'General Admin', serial: 'HM-AER-88231',
      cost: 32000, accum: -16000, nbv: 16000, location: '110610100N', locationDesc: 'ABC_BKK_HQ_5F', room: '5F-A',
      vendor: '6100002210', vendorName: '\u0e1a\u0e08. Office Plus', usefulLifeYear: 8, brand: 'Herman Miller', model: 'Aeron',
      owner: { type: 'org', name: 'General Admin', email: 'headof.ga@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK' }),
    // 4 - vehicle with car number
    A({ id: 'A-004', asset: '715000019005', municipality: '000033050050-0000', assetClass: '7300', assetClassDesc: 'Vehicles',
      capDate: iso(2020, 11, 20), desc1: 'Pickup Truck', desc2: 'Isuzu D-Max',
      costCenter: '29055001', costCenterName: 'Field Operations', serial: 'MPATFS85JLT000912',
      cost: 890000, accum: -534000, nbv: 356000, location: '210610500N', locationDesc: 'ABC_CNX_Depot', room: '',
      vendor: '6100005500', vendorName: '\u0e1a\u0e08. Isuzu North', usefulLifeYear: 10, brand: 'Isuzu', model: 'D-Max',
      carNumber: '\u0e1a\u0e08 4567 \u0e40\u0e0a\u0e35\u0e22\u0e07\u0e43\u0e2b\u0e21\u0e48',
      owner: { type: 'person', name: 'Chalermsak GA-North', email: 'chalermsak.g@wecga.co.th' },
      lat: 18.7883, lng: 98.9853, district: 'Mueang', province: 'Chiang Mai',
      locationBasis: 'employee', tagStatus: 'Tagged', countStatus: 'Found', lastCountDate: iso(2026, 1, 19), area: 'NORTH' }),
    // 5 - router, tagged but not counted
    A({ id: 'A-005', asset: '715000017730', municipality: '000033031812-0000',
      capDate: iso(2021, 2, 10), desc1: 'Router H3C', desc2: 'MSR3600',
      costCenter: '29022005', costCenterName: 'Cloud Implementation', serial: '*235A2ABH209000041',
      cost: 210000, accum: -160000, nbv: 50000, location: '110610300N', locationDesc: 'ABC_BKK_BKK_CBW_Cyber', room: 'BF002',
      eva4: 'DN16', eva4Desc: 'Router and Switch', evGrp5: 'CSLENT23', eva5Desc: 'Cloud Computing Services',
      vendor: '6100003903', vendorName: '\u0e1a\u0e08. ABC', usefulLifeYear: 5, brand: 'H3C', model: 'MSR3600',
      owner: { type: 'org', name: 'Cloud Implementation', email: 'headof.cloud@wecga.co.th' },
      lat: 13.7466, lng: 100.5347, district: 'Huai Khwang', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK' }),
    // 6 - NEW asset from SAP, not yet tagged (awaiting QR)
    A({ id: 'A-006', asset: '715000020110', municipality: '000033060110-0000', assetClass: '7200', assetClassDesc: 'IT Equipment',
      capDate: iso(2026, 1, 5), desc1: 'Monitor Dell 27', desc2: 'U2723QE',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'DLLU2723-5567',
      cost: 18500, accum: 0, nbv: 18500, location: '110610100N', locationDesc: 'ABC_BKK_HQ_9F', room: '9F-IT',
      vendor: '6100004410', vendorName: '\u0e1a\u0e08. Dell TH', usefulLifeYear: 5, brand: 'Dell', model: 'U2723QE',
      owner: { type: 'person', name: 'Wanida Employee', email: 'wanida.e@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Not tagged', countStatus: 'Not counted', area: 'BKK', po: 'PO-4500091231' }),
    // 7 - manual WeCGA asset under 2000 THB (no SAP code)
    A({ id: 'A-007', asset: '', wecgaCode: 'WECGA-AIS-000001', source: 'WeCGA', assetClass: '9000', assetClassDesc: 'Low-value (< 2,000)',
      capDate: iso(2025, 9, 12), desc1: 'Office Fan', desc2: 'Hatari 16"',
      costCenter: '29013300', costCenterName: 'General Admin', serial: 'HT-16-3321',
      cost: 690, accum: 0, nbv: 690, location: '110610100N', locationDesc: 'ABC_BKK_HQ_5F', room: '5F-A',
      po: '', vendor: '', vendorName: '', usefulLifeYear: 3, brand: 'Hatari', model: 'HT-16',
      owner: { type: 'person', name: 'Wanida Employee', email: 'wanida.e@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Found', lastCountDate: iso(2026, 1, 22), area: 'BKK' }),
    // 8 - re-registered asset (written off in SAP but still in use)
    A({ id: 'A-008', asset: '', wecgaCode: 'WECGA-AIS-000002', source: 'reregistered', assetClass: '7200', assetClassDesc: 'IT Equipment',
      capDate: iso(2016, 4, 1), desc1: 'Notebook Lenovo (written off)', desc2: 'ThinkPad T460',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'LNV-T460-0087',
      cost: 38000, accum: -38000, nbv: 0, location: '110610100N', locationDesc: 'ABC_BKK_HQ_9F', room: '9F-IT',
      po: '', vendor: '', vendorName: '', usefulLifeYear: 4, brand: 'Lenovo', model: 'ThinkPad T460',
      owner: { type: 'person', name: 'Kittipong IT', email: 'kittipong.it@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Found', lastCountDate: iso(2026, 1, 21), area: 'BKK' }),
    // 9 - damaged, in a write-off sale ticket
    A({ id: 'A-009', asset: '715000015500', municipality: '000033020500-0000',
      capDate: iso(2019, 7, 1), desc1: 'Switch Cisco (damaged)', desc2: 'Catalyst 2960',
      costCenter: '29022005', costCenterName: 'Cloud Implementation', serial: 'CSC2960-4410',
      cost: 95000, accum: -95000, nbv: 0, location: '110610300N', locationDesc: 'ABC_BKK_BKK_CBW_Cyber', room: 'BF002',
      vendor: '6100003903', vendorName: '\u0e1a\u0e08. ABC', usefulLifeYear: 6, brand: 'Cisco', model: 'Catalyst 2960',
      owner: { type: 'org', name: 'Cloud Implementation', email: 'headof.cloud@wecga.co.th' },
      lat: 13.7466, lng: 100.5347, district: 'Huai Khwang', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Found', lastCountDate: iso(2026, 1, 20), area: 'BKK' }),
    // 10 - lost (theft)
    A({ id: 'A-010', asset: '715000018050', municipality: '000033040150-0000', assetClass: '7200', assetClassDesc: 'IT Equipment',
      capDate: iso(2023, 2, 1), desc1: 'iPad Pro 12.9', desc2: 'M2',
      costCenter: '29055001', costCenterName: 'Field Operations', serial: 'IPADM2-99012',
      cost: 45000, accum: -22500, nbv: 22500, location: '210610500N', locationDesc: 'ABC_CNX_Depot',
      vendor: '6100004999', vendorName: '\u0e1a\u0e08. iStudio', usefulLifeYear: 4, brand: 'Apple', model: 'iPad Pro',
      owner: { type: 'person', name: 'Chalermsak GA-North', email: 'chalermsak.g@wecga.co.th' },
      lat: 18.7883, lng: 98.9853, district: 'Mueang', province: 'Chiang Mai',
      locationBasis: 'employee', tagStatus: 'Tagged', countStatus: 'Not found', lastCountDate: iso(2026, 1, 19), area: 'NORTH' }),
    // 11 - BB company printer, found
    A({ id: 'A-011', asset: '715000030110', municipality: '000034010110-0000', company: '2901', companyCode: 'BB',
      assetClass: '7200', assetClassDesc: 'IT Equipment', capDate: iso(2022, 8, 10), desc1: 'Printer HP LaserJet', desc2: 'M428',
      costCenter: '29511001', costCenterName: 'BB Field Ops', serial: 'HPM428-2231',
      cost: 12000, accum: -6000, nbv: 6000, location: '310610100N', locationDesc: 'BB_BKK_Office_2F', room: '2F',
      vendor: '6100006600', vendorName: '\u0e1a\u0e08. HP TH', usefulLifeYear: 5, brand: 'HP', model: 'LaserJet M428',
      owner: { type: 'person', name: 'Suda Employee (BB)', email: 'suda.e@bb.co.th' },
      lat: 13.79, lng: 100.54, district: 'Chatuchak', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Found', lastCountDate: iso(2026, 1, 20), area: 'BB01' }),
    // 12 - BB not tagged, new
    A({ id: 'A-012', asset: '715000030220', municipality: '000034010220-0000', company: '2901', companyCode: 'BB',
      assetClass: '7150', assetClassDesc: 'Data Network Equip.', capDate: iso(2026, 1, 8), desc1: 'ONT Router', desc2: 'GPON',
      costCenter: '29511001', costCenterName: 'BB Field Ops', serial: 'GPON-ONT-7781',
      cost: 3200, accum: 0, nbv: 3200, location: '320610200N', locationDesc: 'BB_CNX_Node_A', room: '',
      vendor: '6100006601', vendorName: '\u0e1a\u0e08. Fiber TH', usefulLifeYear: 5, brand: 'Huawei', model: 'EchoLife',
      owner: { type: 'org', name: 'BB Field Ops', email: 'headof.bbops@bb.co.th' },
      lat: 18.79, lng: 98.98, district: 'Mueang', province: 'Chiang Mai',
      tagStatus: 'Not tagged', countStatus: 'Not counted', area: 'BB03', po: 'PO-4500091260' }),
    // 13-16 more network gear (Cloud Implementation) for count/dashboard density
    A({ id: 'A-013', asset: '715000017740', municipality: '000033031820-0000', capDate: iso(2021, 5, 3), desc1: 'Firewall Fortinet', desc2: 'FG-100F',
      costCenter: '29022005', costCenterName: 'Cloud Implementation', serial: 'FGT100F-3312', cost: 155000, accum: -93000, nbv: 62000,
      location: '110610300N', locationDesc: 'ABC_BKK_BKK_CBW_Cyber', room: 'BF002', eva4: 'DN16', eva4Desc: 'Router and Switch',
      vendor: '6100003903', vendorName: '\u0e1a\u0e08. ABC', usefulLifeYear: 5, brand: 'Fortinet', model: 'FG-100F',
      owner: { type: 'org', name: 'Cloud Implementation', email: 'headof.cloud@wecga.co.th' },
      lat: 13.7466, lng: 100.5347, district: 'Huai Khwang', province: 'Bangkok', tagStatus: 'Tagged', countStatus: 'Found', lastCountDate: iso(2026, 1, 20), area: 'BKK' }),
    A({ id: 'A-014', asset: '715000017741', municipality: '000033031821-0000', capDate: iso(2021, 5, 3), desc1: 'Access Point Aruba', desc2: 'AP-535',
      costCenter: '29022005', costCenterName: 'Cloud Implementation', serial: 'ARB535-1120', cost: 22000, accum: -13200, nbv: 8800,
      location: '110610300N', locationDesc: 'ABC_BKK_BKK_CBW_Cyber', room: 'BF001',
      vendor: '6100003903', vendorName: '\u0e1a\u0e08. ABC', usefulLifeYear: 5, brand: 'Aruba', model: 'AP-535',
      owner: { type: 'org', name: 'Cloud Implementation', email: 'headof.cloud@wecga.co.th' },
      lat: 13.7466, lng: 100.5347, district: 'Huai Khwang', province: 'Bangkok', tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK' }),
    A({ id: 'A-015', asset: '715000018002', municipality: '000033040111-0000', assetClass: '7200', assetClassDesc: 'IT Equipment', capDate: iso(2024, 1, 15), desc1: 'Notebook HP EliteBook', desc2: '840 G10',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'HPEB840-5590', cost: 39000, accum: -9750, nbv: 29250,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_9F', room: '9F-IT', vendor: '6100006600', vendorName: '\u0e1a\u0e08. HP TH', usefulLifeYear: 4, brand: 'HP', model: 'EliteBook 840',
      owner: { type: 'person', name: 'Wanida Employee', email: 'wanida.e@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok', tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK' }),
    A({ id: 'A-016', asset: '715000018230', municipality: '000033041230-0000', assetClass: '7050', assetClassDesc: 'Furniture & Fixtures', capDate: iso(2022, 3, 1), desc1: 'Meeting Table', desc2: '3m Oak',
      costCenter: '29013300', costCenterName: 'General Admin', serial: 'MT-OAK-0031', cost: 28000, accum: -14000, nbv: 14000,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_5F', room: '5F-MR2', vendor: '6100002210', vendorName: '\u0e1a\u0e08. Office Plus', usefulLifeYear: 10, brand: 'Office Plus', model: 'Oak 3m',
      owner: { type: 'org', name: 'General Admin', email: 'headof.ga@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok', tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK' }),
    // 17 - moved elsewhere (count outcome), send-for-repair in progress
    A({ id: 'A-017', asset: '715000018060', municipality: '000033040160-0000', assetClass: '7200', assetClassDesc: 'IT Equipment', capDate: iso(2023, 9, 1), desc1: 'Laptop MacBook Pro', desc2: '14 M3',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'MBP14M3-2201', cost: 78000, accum: -19500, nbv: 58500,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_9F', room: '9F-IT', vendor: '6100004999', vendorName: '\u0e1a\u0e08. iStudio', usefulLifeYear: 4, brand: 'Apple', model: 'MacBook Pro 14',
      owner: { type: 'person', name: 'Kittipong IT', email: 'kittipong.it@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      locationBasis: 'employee', tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK' }),
    // 18 - donation candidate (old but working projector)
    A({ id: 'A-018', asset: '715000012200', municipality: '000033012200-0000', assetClass: '7250', assetClassDesc: 'Office Equipment', capDate: iso(2017, 6, 1), desc1: 'Projector Epson', desc2: 'EB-2250U',
      costCenter: '29013300', costCenterName: 'General Admin', serial: 'EPB2250-0912', cost: 26000, accum: -26000, nbv: 0,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_5F', room: '5F-MR1', vendor: '6100002210', vendorName: '\u0e1a\u0e08. Office Plus', usefulLifeYear: 6, brand: 'Epson', model: 'EB-2250U',
      owner: { type: 'org', name: 'General Admin', email: 'headof.ga@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok', tagStatus: 'Tagged', countStatus: 'Found', lastCountDate: iso(2026, 1, 22), area: 'BKK' }),
    // 19-20 - low-value manual mass-created batch
    A({ id: 'A-019', asset: '', wecgaCode: 'WECGA-AIS-000003', source: 'WeCGA', assetClass: '9000', assetClassDesc: 'Low-value (< 2,000)', capDate: iso(2025, 10, 1), desc1: 'Desk Lamp', desc2: 'LED',
      costCenter: '29013300', costCenterName: 'General Admin', serial: 'LMP-LED-0021', cost: 450, accum: 0, nbv: 450,
      po: '', location: '110610100N', locationDesc: 'ABC_BKK_HQ_5F', room: '5F-A', usefulLifeYear: 3, brand: 'Philips', model: 'LED Desk',
      owner: { type: 'org', name: 'General Admin', email: 'headof.ga@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok', tagStatus: 'Not tagged', countStatus: 'Not counted', area: 'BKK' }),
    A({ id: 'A-020', asset: '', wecgaCode: 'WECGA-AIS-000004', source: 'WeCGA', assetClass: '9000', assetClassDesc: 'Low-value (< 2,000)', capDate: iso(2025, 10, 1), desc1: 'Keyboard Logitech', desc2: 'MX Keys',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'LGMX-0451', cost: 1900, accum: 0, nbv: 1900,
      po: '', location: '110610100N', locationDesc: 'ABC_BKK_HQ_9F', room: '9F-IT', usefulLifeYear: 3, brand: 'Logitech', model: 'MX Keys',
      owner: { type: 'person', name: 'Kittipong IT', email: 'kittipong.it@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok', tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK' }),
    // 21-22 BB more
    A({ id: 'A-021', asset: '715000030330', municipality: '000034010330-0000', company: '2901', companyCode: 'BB', assetClass: '7300', assetClassDesc: 'Vehicles', capDate: iso(2021, 3, 1), desc1: 'Service Van', desc2: 'Toyota Hiace',
      costCenter: '29511001', costCenterName: 'BB Field Ops', serial: 'JTFHK02P900112', cost: 1200000, accum: -600000, nbv: 600000,
      location: '310610100N', locationDesc: 'BB_BKK_Office_2F', vendor: '6100005500', vendorName: '\u0e1a\u0e08. Toyota', usefulLifeYear: 10, brand: 'Toyota', model: 'Hiace',
      carNumber: '1\u0e01\u0e01 8899 \u0e01\u0e23\u0e38\u0e07\u0e40\u0e17\u0e1e\u0e2f',
      owner: { type: 'person', name: 'Suda Employee (BB)', email: 'suda.e@bb.co.th' },
      lat: 13.79, lng: 100.54, district: 'Chatuchak', province: 'Bangkok', tagStatus: 'Tagged', countStatus: 'Found', lastCountDate: iso(2026, 1, 20), area: 'BB01' }),
    A({ id: 'A-022', asset: '715000030440', municipality: '000034010440-0000', company: '2901', companyCode: 'BB', assetClass: '7200', assetClassDesc: 'IT Equipment', capDate: iso(2024, 5, 1), desc1: 'Notebook Acer', desc2: 'TravelMate',
      costCenter: '29511001', costCenterName: 'BB Field Ops', serial: 'ACRTM-1120', cost: 25000, accum: -6250, nbv: 18750,
      location: '320610200N', locationDesc: 'BB_CNX_Node_A', vendor: '6100006602', vendorName: '\u0e1a\u0e08. Acer', usefulLifeYear: 4, brand: 'Acer', model: 'TravelMate',
      owner: { type: 'person', name: 'Suda Employee (BB)', email: 'suda.e@bb.co.th' },
      lat: 18.79, lng: 98.98, district: 'Mueang', province: 'Chiang Mai', tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BB03' }),
    // 23 - transfer in progress asset
    A({ id: 'A-023', asset: '715000018070', municipality: '000033040170-0000', assetClass: '7200', assetClassDesc: 'IT Equipment', capDate: iso(2023, 11, 1), desc1: 'Notebook Dell XPS', desc2: '15',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'DLLXPS15-3390', cost: 62000, accum: -15500, nbv: 46500,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_9F', room: '9F-IT', vendor: '6100004410', vendorName: '\u0e1a\u0e08. Dell TH', usefulLifeYear: 4, brand: 'Dell', model: 'XPS 15',
      owner: { type: 'person', name: 'Wanida Employee', email: 'wanida.e@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      locationBasis: 'employee', tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK' }),
    // 24 - wrong owner/location found on count -> needs transfer
    A({ id: 'A-024', asset: '715000018080', municipality: '000033040180-0000', assetClass: '7200', assetClassDesc: 'IT Equipment', capDate: iso(2022, 12, 1), desc1: 'Monitor LG UltraWide', desc2: '34"',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'LG34UW-2201', cost: 21000, accum: -10500, nbv: 10500,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_9F', room: '9F-IT', vendor: '6100006600', vendorName: '\u0e1a\u0e08. HP TH', usefulLifeYear: 5, brand: 'LG', model: '34WN',
      owner: { type: 'person', name: 'Kittipong IT', email: 'kittipong.it@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok', tagStatus: 'Tagged', countStatus: 'Found', lastCountDate: iso(2026, 1, 21), area: 'BKK' }),
    // 25 - borrowed item
    A({ id: 'A-025', asset: '715000018090', municipality: '000033040190-0000', assetClass: '7250', assetClassDesc: 'Office Equipment', capDate: iso(2023, 4, 1), desc1: 'Portable Projector', desc2: 'Anker Nebula',
      costCenter: '29013300', costCenterName: 'General Admin', serial: 'ANK-NEB-0091', cost: 15000, accum: -7500, nbv: 7500,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_5F', room: '5F-Store', vendor: '6100002210', vendorName: '\u0e1a\u0e08. Office Plus', usefulLifeYear: 4, brand: 'Anker', model: 'Nebula',
      owner: { type: 'org', name: 'General Admin', email: 'headof.ga@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok', tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK' }),
  ];

  // ponytail: batch mock assets — tagging queue density + area spread
  (function () {
    const owners = [
      { type: 'person', name: 'Wanida Employee', email: 'wanida.e@wecga.co.th' },
      { type: 'person', name: 'Kittipong IT', email: 'kittipong.it@wecga.co.th' },
      { type: 'org', name: 'General Admin', email: 'headof.ga@wecga.co.th' },
      { type: 'org', name: 'Cloud Implementation', email: 'headof.cloud@wecga.co.th' },
    ];
    const geo = {
      BKK: { lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok', loc: '110610100N', locDesc: 'ABC_BKK_HQ_9F', cc: '29011002', ccName: 'IT Infrastructure' },
      CENTRAL: { lat: 14.9799, lng: 102.0977, district: 'Mueang', province: 'Nakhon Ratchasima', loc: '120610100N', locDesc: 'ABC_KORAT_Branch', cc: '29044001', ccName: 'Central Region Ops' },
      NORTH: { lat: 18.7883, lng: 98.9853, district: 'Mueang', province: 'Chiang Mai', loc: '210610500N', locDesc: 'ABC_CNX_Depot', cc: '29055001', ccName: 'Field Operations' },
      NORTHEAST: { lat: 16.4419, lng: 102.8360, district: 'Mueang', province: 'Khon Kaen', loc: '130610100N', locDesc: 'ABC_KKN_Branch', cc: '29045001', ccName: 'Northeast Ops' },
      EAST: { lat: 13.3611, lng: 100.9847, district: 'Mueang', province: 'Chonburi', loc: '140610100N', locDesc: 'ABC_CBI_Branch', cc: '29046001', ccName: 'East Region Ops' },
      SOUTH: { lat: 7.8804, lng: 98.3923, district: 'Mueang', province: 'Phuket', loc: '150610100N', locDesc: 'ABC_HKT_Branch', cc: '29047001', ccName: 'South Region Ops' },
      BB01: { lat: 13.79, lng: 100.54, district: 'Chatuchak', province: 'Bangkok', loc: '310610100N', locDesc: 'BB_BKK_Office_2F', cc: '29511001', ccName: 'BB Field Ops', company: '2901', companyCode: 'BB' },
      BB02: { lat: 13.8621, lng: 100.5144, district: 'Mueang', province: 'Nonthaburi', loc: '311610100N', locDesc: 'BB_NTB_Node', cc: '29511001', ccName: 'BB Field Ops', company: '2901', companyCode: 'BB' },
      BB03: { lat: 18.79, lng: 98.98, district: 'Mueang', province: 'Chiang Mai', loc: '320610200N', locDesc: 'BB_CNX_Node_A', cc: '29511001', ccName: 'BB Field Ops', company: '2901', companyCode: 'BB' },
    };
    const catalog = [
      ['Keyboard Dell', 'KB216', 'Dell', 'KB216'], ['Mouse Logitech', 'M650', 'Logitech', 'M650'],
      ['Webcam Logitech', 'C920', 'Logitech', 'C920'], ['Headset Jabra', 'Evolve2 40', 'Jabra', 'Evolve2 40'],
      ['Docking Station', 'UD22', 'Dell', 'UD22'], ['USB-C Hub', '7-in-1', 'Anker', 'A8346'],
      ['Monitor Dell 24', 'P2423D', 'Dell', 'P2423D'], ['Monitor LG 27', '27UL850', 'LG', '27UL850'],
      ['Monitor Samsung 32', 'M7', 'Samsung', 'M7'], ['Notebook HP', 'ProBook 450', 'HP', 'ProBook 450'],
      ['Notebook Lenovo', 'ThinkPad E14', 'Lenovo', 'ThinkPad E14'], ['Tablet Samsung', 'Tab S9', 'Samsung', 'Tab S9'],
      ['Printer HP', 'M404dn', 'HP', 'M404dn'], ['Scanner Fujitsu', 'fi-7160', 'Fujitsu', 'fi-7160'],
      ['Switch H3C 24p', 'S5120', 'H3C', 'S5120'], ['Access Point', 'AP505', 'Aruba', 'AP505'],
      ['UPS APC', 'Smart-750', 'APC', 'Smart-750'], ['Projector Epson', 'EB-L200F', 'Epson', 'EB-L200F'],
      ['Office Chair', 'Ergo Lite', 'WorkPro', 'Ergo Lite'], ['Standing Desk', 'Electric 160', 'WorkPro', 'Stand160'],
      ['Filing Cabinet', '4-drawer', 'Lucky', 'FC-4D'], ['Whiteboard', '120x90', 'Quartet', 'WB-120'],
      ['Safe Box', 'Fireproof S', 'Sentry', 'SFW123'], ['Barcode Scanner', 'DS2208', 'Zebra', 'DS2208'],
      ['Label Printer', 'ZD421', 'Zebra', 'ZD421'], ['Network Patch Panel', '24p Cat6', 'CommScope', 'PP-24'],
      ['Fiber ONT', 'GPON HG8245', 'Huawei', 'HG8245'], ['VoIP Phone', 'T46U', 'Yealink', 'T46U'],
      ['Conference Camera', 'MeetUp', 'Logitech', 'MeetUp'], ['Shredder', 'Cross-cut', 'Fellowes', 'Powershred'],
    ];
    let n = 26;
    const specs = [
      ...Array(18).fill(null).map((_, i) => ({ area: 'BKK', tagStatus: 'Not tagged', cat: i })),
      ...Array(4).fill(null).map((_, i) => ({ area: 'NORTH', tagStatus: 'Not tagged', cat: 18 + i })),
      ...['CENTRAL', 'NORTHEAST', 'EAST', 'SOUTH'].flatMap(ar => Array(2).fill(null).map((_, i) => ({ area: ar, tagStatus: 'Not tagged', cat: 22 + i }))),
      ...Array(6).fill(null).map((_, i) => ({ area: 'BB01', tagStatus: 'Not tagged', cat: i, bb: true })),
      ...Array(4).fill(null).map((_, i) => ({ area: 'BB02', tagStatus: 'Not tagged', cat: 6 + i, bb: true })),
      ...Array(4).fill(null).map((_, i) => ({ area: 'BB03', tagStatus: 'Not tagged', cat: 10 + i, bb: true })),
      ...Array(8).fill(null).map((_, i) => ({ area: i % 2 ? 'NORTH' : 'BKK', tagStatus: 'Tagged', countStatus: 'Not counted', cat: 14 + i })),
    ];
    specs.forEach((sp, idx) => {
      const g = geo[sp.area];
      const c = catalog[sp.cat % catalog.length];
      const sapNum = 715000030000 + n;
      const owner = owners[idx % owners.length];
      assets.push(A({
        id: 'A-' + String(n).padStart(3, '0'),
        asset: String(sapNum),
        municipality: '00003' + String(3060000 + n).slice(-7) + '-0000',
        company: g.company || '2900', companyCode: g.companyCode || 'AIS',
        assetClass: sp.bb ? '7150' : '7200', assetClassDesc: sp.bb ? 'Data Network Equip.' : 'IT Equipment',
        capDate: iso(2026, 1, 2 + (idx % 20), 9, 0),
        desc1: c[0], desc2: c[1], brand: c[2], model: c[3],
        costCenter: g.cc, costCenterName: g.ccName,
        serial: c[2].slice(0, 3).toUpperCase() + '-' + n + '-' + String(idx).padStart(3, '0'),
        cost: 1500 + (idx % 12) * 2500, accum: 0, nbv: 1500 + (idx % 12) * 2500,
        location: g.loc, locationDesc: g.locDesc, room: sp.area === 'BKK' ? '9F-IT' : '',
        vendor: '6100004410', vendorName: '\u0e1a\u0e08. Demo Vendor', usefulLifeYear: 5,
        owner, lat: g.lat, lng: g.lng, district: g.district, province: g.province,
        tagStatus: sp.tagStatus, countStatus: sp.countStatus || 'Not counted',
        area: sp.area,
      }));
      n++;
    });
  })();

  // Demo procurement assets — linked to purchaseOrders, untagged, ready for GR → appointment → tagging demo
  assets.push(
    A({ id: 'A-078', asset: '715000020220', municipality: '000033062220-0000', capDate: iso(2026, 1, 18),
      desc1: 'Firewall Fortinet', desc2: 'FG-100F', brand: 'Fortinet', model: 'FG-100F',
      costCenter: '29022005', costCenterName: 'Cloud Implementation', serial: 'FGT100F-DEMO78',
      cost: 155000, accum: 0, nbv: 155000, location: '110610300N', locationDesc: 'ABC_BKK_BKK_CBW_Cyber', room: 'BF002',
      eva4: 'DN16', eva4Desc: 'Router and Switch', vendor: '6100003903', vendorName: '\u0e1a\u0e08. ABC', usefulLifeYear: 5,
      owner: { type: 'org', name: 'Cloud Implementation', email: 'headof.cloud@wecga.co.th' },
      lat: 13.7466, lng: 100.5347, district: 'Huai Khwang', province: 'Bangkok',
      tagStatus: 'Not tagged', countStatus: 'Not counted', area: 'BKK', po: 'PO-4500091190' }),
    A({ id: 'A-079', asset: '715000020331', municipality: '000033063310-0000', assetClass: '7200', assetClassDesc: 'IT Equipment',
      capDate: iso(2026, 1, 20), desc1: 'Notebook HP EliteBook', desc2: '840 G10', brand: 'HP', model: 'EliteBook 840 G10',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'HPEB840-D79', cost: 39000, accum: 0, nbv: 39000,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_9F', room: '9F-IT', vendor: '6100006600', vendorName: '\u0e1a\u0e08. HP TH', usefulLifeYear: 4,
      owner: { type: 'person', name: 'Wanida Employee', email: 'wanida.e@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Not tagged', countStatus: 'Not counted', area: 'BKK', po: 'PO-4500091255' }),
    A({ id: 'A-080', asset: '715000020332', municipality: '000033063320-0000', assetClass: '7200', assetClassDesc: 'IT Equipment',
      capDate: iso(2026, 1, 20), desc1: 'Notebook HP EliteBook', desc2: '840 G10', brand: 'HP', model: 'EliteBook 840 G10',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'HPEB840-D80', cost: 39000, accum: 0, nbv: 39000,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_9F', room: '9F-IT', vendor: '6100006600', vendorName: '\u0e1a\u0e08. HP TH', usefulLifeYear: 4,
      owner: { type: 'person', name: 'Kittipong IT', email: 'kittipong.it@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Not tagged', countStatus: 'Not counted', area: 'BKK', po: 'PO-4500091255' }),
    A({ id: 'A-081', asset: '715000020333', municipality: '000033063330-0000', assetClass: '7200', assetClassDesc: 'IT Equipment',
      capDate: iso(2026, 1, 20), desc1: 'Notebook HP EliteBook', desc2: '840 G10', brand: 'HP', model: 'EliteBook 840 G10',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'HPEB840-D81', cost: 39000, accum: 0, nbv: 39000,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_9F', room: '9F-IT', vendor: '6100006600', vendorName: '\u0e1a\u0e08. HP TH', usefulLifeYear: 4,
      owner: { type: 'person', name: 'Wanida Employee', email: 'wanida.e@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Not tagged', countStatus: 'Not counted', area: 'BKK', po: 'PO-4500091255' }),
    A({ id: 'A-082', asset: '715000020334', municipality: '000033063340-0000', assetClass: '7200', assetClassDesc: 'IT Equipment',
      capDate: iso(2026, 1, 20), desc1: 'Notebook HP EliteBook', desc2: '840 G10', brand: 'HP', model: 'EliteBook 840 G10',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'HPEB840-D82', cost: 39000, accum: 0, nbv: 39000,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_9F', room: '9F-IT', vendor: '6100006600', vendorName: '\u0e1a\u0e08. HP TH', usefulLifeYear: 4,
      owner: { type: 'person', name: 'Kittipong IT', email: 'kittipong.it@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Not tagged', countStatus: 'Not counted', area: 'BKK', po: 'PO-4500091255' }),
    A({ id: 'A-083', asset: '715000020335', municipality: '000033063350-0000', assetClass: '7200', assetClassDesc: 'IT Equipment',
      capDate: iso(2026, 1, 20), desc1: 'Notebook HP EliteBook', desc2: '840 G10', brand: 'HP', model: 'EliteBook 840 G10',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'HPEB840-D83', cost: 39000, accum: 0, nbv: 39000,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_9F', room: '9F-IT', vendor: '6100006600', vendorName: '\u0e1a\u0e08. HP TH', usefulLifeYear: 4,
      owner: { type: 'person', name: 'Wanida Employee', email: 'wanida.e@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Not tagged', countStatus: 'Not counted', area: 'BKK', po: 'PO-4500091255' }),
    A({ id: 'A-084', asset: '715000030550', municipality: '000034030550-0000', company: '2901', companyCode: 'BB',
      assetClass: '7150', assetClassDesc: 'Data Network Equip.', capDate: iso(2026, 1, 22), desc1: 'Switch Huawei', desc2: 'S5720-28P', brand: 'Huawei', model: 'S5720',
      costCenter: '29511001', costCenterName: 'BB Field Ops', serial: 'HW-S5720-D84', cost: 42000, accum: 0, nbv: 42000,
      location: '320610200N', locationDesc: 'BB_CNX_Node_A', vendor: '6100007700', vendorName: '\u0e1a\u0e08. Huawei TH', usefulLifeYear: 5,
      owner: { type: 'org', name: 'BB Field Ops', email: 'headof.bbops@bb.co.th' },
      lat: 18.79, lng: 98.98, district: 'Mueang', province: 'Chiang Mai',
      tagStatus: 'Not tagged', countStatus: 'Not counted', area: 'BB03', po: 'PO-4500091299' }),
    A({ id: 'A-085', asset: '715000030551', municipality: '000034030551-0000', company: '2901', companyCode: 'BB',
      assetClass: '7150', assetClassDesc: 'Data Network Equip.', capDate: iso(2026, 1, 22), desc1: 'Switch Huawei', desc2: 'S5720-28P', brand: 'Huawei', model: 'S5720',
      costCenter: '29511001', costCenterName: 'BB Field Ops', serial: 'HW-S5720-D85', cost: 42000, accum: 0, nbv: 42000,
      location: '320610200N', locationDesc: 'BB_CNX_Node_A', vendor: '6100007700', vendorName: '\u0e1a\u0e08. Huawei TH', usefulLifeYear: 5,
      owner: { type: 'org', name: 'BB Field Ops', email: 'headof.bbops@bb.co.th' },
      lat: 18.79, lng: 98.98, district: 'Mueang', province: 'Chiang Mai',
      tagStatus: 'Not tagged', countStatus: 'Not counted', area: 'BB03', po: 'PO-4500091299' }),
    // Handover demo — tagged assets at staging / HQ units (p.3 item 9)
    A({ id: 'A-086', asset: '715000020401', municipality: '000033064010-0000', assetClass: '7200', assetClassDesc: 'IT Equipment',
      capDate: iso(2026, 1, 10), desc1: 'Docking Station', desc2: 'Dell UD22', brand: 'Dell', model: 'UD22',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'DLL-UD22-H086', cost: 8500, accum: 0, nbv: 8500,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_G_Loading', room: 'G-Loading', vendor: '6100004410', vendorName: '\u0e1a\u0e08. Dell TH', usefulLifeYear: 4,
      owner: { type: 'person', name: 'Wanida Employee', email: 'wanida.e@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK', photos: mkPhotos(13.7563, 100.5018, 'Pathum Wan', 'Bangkok') }),
    A({ id: 'A-087', asset: '715000020402', municipality: '000033064020-0000', assetClass: '7200', assetClassDesc: 'IT Equipment',
      capDate: iso(2026, 1, 10), desc1: 'Notebook HP', desc2: 'ProBook 450', brand: 'HP', model: 'ProBook 450',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'HPPB450-H087', cost: 32000, accum: 0, nbv: 32000,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_G_Loading', room: 'G-Loading', vendor: '6100006600', vendorName: '\u0e1a\u0e08. HP TH', usefulLifeYear: 4,
      owner: { type: 'person', name: 'Kittipong IT', email: 'kittipong.it@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      locationBasis: 'employee', tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK', photos: mkPhotos(13.7563, 100.5018, 'Pathum Wan', 'Bangkok') }),
    A({ id: 'A-088', asset: '715000020403', municipality: '000033064030-0000', assetClass: '7250', assetClassDesc: 'Office Equipment',
      capDate: iso(2026, 1, 11), desc1: 'Label Printer', desc2: 'Zebra ZD421', brand: 'Zebra', model: 'ZD421',
      costCenter: '29013300', costCenterName: 'General Admin', serial: 'ZEB-ZD421-H088', cost: 14500, accum: 0, nbv: 14500,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_G_Loading', room: 'G-Loading', vendor: '6100002210', vendorName: '\u0e1a\u0e08. Office Plus', usefulLifeYear: 5,
      owner: { type: 'org', name: 'General Admin', email: 'headof.ga@wecga.co.th' }, orgName: 'General Admin', orgHeadEmail: 'headof.ga@wecga.co.th',
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK', photos: mkPhotos(13.7563, 100.5018, 'Pathum Wan', 'Bangkok') }),
    A({ id: 'A-089', asset: '715000020404', municipality: '000033064040-0000', assetClass: '7250', assetClassDesc: 'Office Equipment',
      capDate: iso(2026, 1, 11), desc1: 'UPS APC', desc2: 'Smart-750', brand: 'APC', model: 'Smart-750',
      costCenter: '29013300', costCenterName: 'General Admin', serial: 'APC-S750-H089', cost: 6200, accum: 0, nbv: 6200,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_G_Loading', room: 'G-Loading', vendor: '6100002210', vendorName: '\u0e1a\u0e08. Office Plus', usefulLifeYear: 5,
      owner: { type: 'org', name: 'General Admin', email: 'headof.ga@wecga.co.th' }, orgName: 'General Admin', orgHeadEmail: 'headof.ga@wecga.co.th',
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK', photos: mkPhotos(13.7563, 100.5018, 'Pathum Wan', 'Bangkok') }),
    A({ id: 'A-090', asset: '715000020405', municipality: '000033064050-0000', assetClass: '7200', assetClassDesc: 'IT Equipment',
      capDate: iso(2026, 1, 12), desc1: 'Monitor Dell 24', desc2: 'P2423D', brand: 'Dell', model: 'P2423D',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'DLL-P2423-H090', cost: 9800, accum: 0, nbv: 9800,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_9F', room: '9F-IT', vendor: '6100004410', vendorName: '\u0e1a\u0e08. Dell TH', usefulLifeYear: 5,
      owner: { type: 'person', name: 'Wanida Employee', email: 'wanida.e@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK', photos: mkPhotos(13.7563, 100.5018, 'Pathum Wan', 'Bangkok') }),
    A({ id: 'A-091', asset: '715000020406', municipality: '000033064060-0000', assetClass: '7200', assetClassDesc: 'IT Equipment',
      capDate: iso(2026, 1, 12), desc1: 'Webcam Logitech', desc2: 'C920', brand: 'Logitech', model: 'C920',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'LOG-C920-H091', cost: 3200, accum: 0, nbv: 3200,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_9F', room: '9F-IT', vendor: '6100004410', vendorName: '\u0e1a\u0e08. Dell TH', usefulLifeYear: 4,
      owner: { type: 'person', name: 'Kittipong IT', email: 'kittipong.it@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      locationBasis: 'employee', tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK', photos: mkPhotos(13.7563, 100.5018, 'Pathum Wan', 'Bangkok') }),
    A({ id: 'A-092', asset: '715000020407', municipality: '000033064070-0000', assetClass: '7150', assetClassDesc: 'Data Network Equip.',
      capDate: iso(2026, 1, 13), desc1: 'Switch H3C 24p', desc2: 'S5120', brand: 'H3C', model: 'S5120',
      costCenter: '29022005', costCenterName: 'Cloud Implementation', serial: 'H3C-S5120-H092', cost: 88000, accum: 0, nbv: 88000,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_9F', room: '9F-IT', eva4: 'DN16', eva4Desc: 'Router and Switch',
      vendor: '6100003903', vendorName: '\u0e1a\u0e08. ABC', usefulLifeYear: 5,
      owner: { type: 'org', name: 'Cloud Implementation', email: 'headof.cloud@wecga.co.th' }, orgName: 'Cloud Implementation', orgHeadEmail: 'headof.cloud@wecga.co.th',
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK', photos: mkPhotos(13.7563, 100.5018, 'Pathum Wan', 'Bangkok') }),
    A({ id: 'A-093', asset: '715000020408', municipality: '000033064080-0000', assetClass: '7050', assetClassDesc: 'Furniture & Fixtures',
      capDate: iso(2026, 1, 14), desc1: 'Office Chair', desc2: 'Ergo Lite', brand: 'WorkPro', model: 'Ergo Lite',
      costCenter: '29013300', costCenterName: 'General Admin', serial: 'WP-CHAIR-H093', cost: 8900, accum: 0, nbv: 8900,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_5F', room: '5F-A', vendor: '6100002210', vendorName: '\u0e1a\u0e08. Office Plus', usefulLifeYear: 8,
      owner: { type: 'org', name: 'General Admin', email: 'headof.ga@wecga.co.th' }, orgName: 'General Admin', orgHeadEmail: 'headof.ga@wecga.co.th',
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK', photos: mkPhotos(13.7563, 100.5018, 'Pathum Wan', 'Bangkok') }),
    A({ id: 'A-094', asset: '715000020409', municipality: '000033064090-0000', assetClass: '7050', assetClassDesc: 'Furniture & Fixtures',
      capDate: iso(2026, 1, 14), desc1: 'Standing Desk', desc2: 'Electric 160', brand: 'WorkPro', model: 'Stand160',
      costCenter: '29013300', costCenterName: 'General Admin', serial: 'WP-DESK-H094', cost: 18500, accum: 0, nbv: 18500,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_5F', room: '5F-A', vendor: '6100002210', vendorName: '\u0e1a\u0e08. Office Plus', usefulLifeYear: 8,
      owner: { type: 'person', name: 'Wanida Employee', email: 'wanida.e@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK', photos: mkPhotos(13.7563, 100.5018, 'Pathum Wan', 'Bangkok') }),
    A({ id: 'A-095', asset: '715000030560', municipality: '000034030560-0000', company: '2901', companyCode: 'BB',
      assetClass: '7250', assetClassDesc: 'Office Equipment', capDate: iso(2026, 1, 15), desc1: 'Label Printer', desc2: 'Zebra ZD421', brand: 'Zebra', model: 'ZD421',
      costCenter: '29511001', costCenterName: 'BB Field Ops', serial: 'ZEB-ZD421-B095', cost: 14000, accum: 0, nbv: 14000,
      location: '310610100N', locationDesc: 'BB_BKK_Office_2F', room: '2F', vendor: '6100006600', vendorName: '\u0e1a\u0e08. HP TH', usefulLifeYear: 5,
      owner: { type: 'person', name: 'Suda Employee (BB)', email: 'suda.e@bb.co.th' },
      lat: 13.79, lng: 100.54, district: 'Chatuchak', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BB01', photos: mkPhotos(13.79, 100.54, 'Chatuchak', 'Bangkok') }),
    A({ id: 'A-096', asset: '715000030561', municipality: '000034030561-0000', company: '2901', companyCode: 'BB',
      assetClass: '7200', assetClassDesc: 'IT Equipment', capDate: iso(2026, 1, 15), desc1: 'VoIP Phone', desc2: 'Yealink T46U', brand: 'Yealink', model: 'T46U',
      costCenter: '29511001', costCenterName: 'BB Field Ops', serial: 'YEA-T46U-B096', cost: 4500, accum: 0, nbv: 4500,
      location: '310610100N', locationDesc: 'BB_BKK_Office_2F', room: '2F', vendor: '6100006600', vendorName: '\u0e1a\u0e08. HP TH', usefulLifeYear: 4,
      owner: { type: 'org', name: 'BB Field Ops', email: 'headof.bbops@bb.co.th' }, orgName: 'BB Field Ops', orgHeadEmail: 'headof.bbops@bb.co.th',
      lat: 13.79, lng: 100.54, district: 'Chatuchak', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BB01', photos: mkPhotos(13.79, 100.54, 'Chatuchak', 'Bangkok') }),
    // Handover demo — Organization holders (H3) alongside Individual at G-Loading / HQ
    A({ id: 'A-097', asset: '715000020501', municipality: '000033065010-0000', assetClass: '7250', assetClassDesc: 'Office Equipment',
      capDate: iso(2026, 1, 16), desc1: 'Projector Epson', desc2: 'EB-L200F', brand: 'Epson', model: 'EB-L200F',
      costCenter: '29022005', costCenterName: 'Cloud Implementation', serial: 'EPS-L200F-H097', cost: 52000, accum: 0, nbv: 52000,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_G_Loading', room: 'G-Loading', vendor: '6100002210', vendorName: '\u0e1a\u0e08. Office Plus', usefulLifeYear: 6,
      owner: { type: 'org', name: 'Cloud Implementation', email: 'headof.cloud@wecga.co.th' }, orgName: 'Cloud Implementation', orgHeadEmail: 'headof.cloud@wecga.co.th',
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK', photos: mkPhotos(13.7563, 100.5018, 'Pathum Wan', 'Bangkok') }),
    A({ id: 'A-098', asset: '715000020502', municipality: '000033065020-0000', assetClass: '7200', assetClassDesc: 'IT Equipment',
      capDate: iso(2026, 1, 16), desc1: 'Barcode Scanner', desc2: 'Zebra DS2208', brand: 'Zebra', model: 'DS2208',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'ZEB-DS2208-H098', cost: 6800, accum: 0, nbv: 6800,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_G_Loading', room: 'G-Loading', vendor: '6100004410', vendorName: '\u0e1a\u0e08. Dell TH', usefulLifeYear: 5,
      owner: { type: 'org', name: 'IT Infrastructure', email: 'headof.it@wecga.co.th' }, orgName: 'IT Infrastructure', orgHeadEmail: 'headof.it@wecga.co.th',
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK', photos: mkPhotos(13.7563, 100.5018, 'Pathum Wan', 'Bangkok') }),
    A({ id: 'A-099', asset: '715000020503', municipality: '000033065030-0000', assetClass: '7150', assetClassDesc: 'Data Network Equip.',
      capDate: iso(2026, 1, 17), desc1: 'Access Point', desc2: 'Aruba AP505', brand: 'Aruba', model: 'AP505',
      costCenter: '29022005', costCenterName: 'Cloud Implementation', serial: 'ARB-AP505-H099', cost: 18500, accum: 0, nbv: 18500,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_G_Loading', room: 'G-Loading', eva4: 'DN16', eva4Desc: 'Router and Switch',
      vendor: '6100003903', vendorName: '\u0e1a\u0e08. ABC', usefulLifeYear: 5,
      owner: { type: 'org', name: 'Cloud Implementation', email: 'headof.cloud@wecga.co.th' }, orgName: 'Cloud Implementation', orgHeadEmail: 'headof.cloud@wecga.co.th',
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK', photos: mkPhotos(13.7563, 100.5018, 'Pathum Wan', 'Bangkok') }),
    A({ id: 'A-100', asset: '715000020504', municipality: '000033065040-0000', assetClass: '7250', assetClassDesc: 'Office Equipment',
      capDate: iso(2026, 1, 17), desc1: 'Shredder', desc2: 'Fellowes Cross-cut', brand: 'Fellowes', model: 'Powershred',
      costCenter: '29013300', costCenterName: 'General Admin', serial: 'FEL-SHRD-H100', cost: 11200, accum: 0, nbv: 11200,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_5F_Store', room: '5F-Store', vendor: '6100002210', vendorName: '\u0e1a\u0e08. Office Plus', usefulLifeYear: 5,
      owner: { type: 'org', name: 'General Admin', email: 'headof.ga@wecga.co.th' }, orgName: 'General Admin', orgHeadEmail: 'headof.ga@wecga.co.th',
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK', photos: mkPhotos(13.7563, 100.5018, 'Pathum Wan', 'Bangkok') }),
    A({ id: 'A-101', asset: '715000020505', municipality: '000033065050-0000', assetClass: '7250', assetClassDesc: 'Office Equipment',
      capDate: iso(2026, 1, 18), desc1: 'Conference Camera', desc2: 'Logitech MeetUp', brand: 'Logitech', model: 'MeetUp',
      costCenter: '29022005', costCenterName: 'Cloud Implementation', serial: 'LOG-MTU-H101', cost: 42000, accum: 0, nbv: 42000,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_8F_Exec', room: '8F-Exec', vendor: '6100004410', vendorName: '\u0e1a\u0e08. Dell TH', usefulLifeYear: 5,
      owner: { type: 'org', name: 'Cloud Implementation', email: 'headof.cloud@wecga.co.th' }, orgName: 'Cloud Implementation', orgHeadEmail: 'headof.cloud@wecga.co.th',
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK', photos: mkPhotos(13.7563, 100.5018, 'Pathum Wan', 'Bangkok') }),
    A({ id: 'A-102', asset: '715000020506', municipality: '000033065060-0000', assetClass: '7200', assetClassDesc: 'IT Equipment',
      capDate: iso(2026, 1, 18), desc1: 'Tablet Samsung', desc2: 'Tab S9', brand: 'Samsung', model: 'Tab S9',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'SAM-TABS9-H102', cost: 28000, accum: 0, nbv: 28000,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_G_Loading', room: 'G-Loading', vendor: '6100004999', vendorName: '\u0e1a\u0e08. iStudio', usefulLifeYear: 4,
      owner: { type: 'person', name: 'Wanida Employee', email: 'wanida.e@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK', photos: mkPhotos(13.7563, 100.5018, 'Pathum Wan', 'Bangkok') }),
    // Organization handover demo — one tagged asset per org at a distinct unit (see comment block below)
    A({ id: 'A-103', asset: '715000020601', municipality: '000033066010-0000', assetClass: '7050', assetClassDesc: 'Furniture & Fixtures',
      capDate: iso(2026, 1, 19), desc1: 'Whiteboard', desc2: '120x90', brand: 'Quartet', model: 'WB-120',
      costCenter: '29013300', costCenterName: 'General Admin', serial: 'QRT-WB-H103', cost: 4500, accum: 0, nbv: 4500,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_5F_MR1', room: '5F-MR1', vendor: '6100002210', vendorName: '\u0e1a\u0e08. Office Plus', usefulLifeYear: 8,
      owner: { type: 'org', name: 'General Admin', email: 'headof.ga@wecga.co.th' }, orgName: 'General Admin', orgHeadEmail: 'headof.ga@wecga.co.th',
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK', photos: mkPhotos(13.7563, 100.5018, 'Pathum Wan', 'Bangkok') }),
    A({ id: 'A-104', asset: '715000020602', municipality: '000033066020-0000', assetClass: '7150', assetClassDesc: 'Data Network Equip.',
      capDate: iso(2026, 1, 19), desc1: 'Router H3C', desc2: 'MSR3600', brand: 'H3C', model: 'MSR3600',
      costCenter: '29022005', costCenterName: 'Cloud Implementation', serial: 'H3C-MSR-H104', cost: 210000, accum: 0, nbv: 210000,
      location: '110610300N', locationDesc: 'ABC_BKK_BF001', room: 'BF001', eva4: 'DN16', eva4Desc: 'Router and Switch',
      vendor: '6100003903', vendorName: '\u0e1a\u0e08. ABC', usefulLifeYear: 5,
      owner: { type: 'org', name: 'Cloud Implementation', email: 'headof.cloud@wecga.co.th' }, orgName: 'Cloud Implementation', orgHeadEmail: 'headof.cloud@wecga.co.th',
      lat: 13.7466, lng: 100.5347, district: 'Huai Khwang', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK', photos: mkPhotos(13.7466, 100.5347, 'Huai Khwang', 'Bangkok') }),
    A({ id: 'A-105', asset: '715000020603', municipality: '000033066030-0000', assetClass: '7200', assetClassDesc: 'IT Equipment',
      capDate: iso(2026, 1, 20), desc1: 'Printer HP', desc2: 'M404dn', brand: 'HP', model: 'M404dn',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'HPM404-H105', cost: 11500, accum: 0, nbv: 11500,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_9F', room: '9F-IT', vendor: '6100006600', vendorName: '\u0e1a\u0e08. HP TH', usefulLifeYear: 5,
      owner: { type: 'org', name: 'IT Infrastructure', email: 'headof.it@wecga.co.th' }, orgName: 'IT Infrastructure', orgHeadEmail: 'headof.it@wecga.co.th',
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK', photos: mkPhotos(13.7563, 100.5018, 'Pathum Wan', 'Bangkok') }),
    A({ id: 'A-106', asset: '715000020604', municipality: '000033066040-0000', assetClass: '7200', assetClassDesc: 'IT Equipment',
      capDate: iso(2026, 1, 20), desc1: 'Rugged Tablet', desc2: 'Field kit', brand: 'Samsung', model: 'Tab Active',
      costCenter: '29055001', costCenterName: 'Field Operations', serial: 'SAM-ACT-H106', cost: 22000, accum: 0, nbv: 22000,
      location: '210610500N', locationDesc: 'ABC_CNX_Depot', room: '', vendor: '6100004999', vendorName: '\u0e1a\u0e08. iStudio', usefulLifeYear: 4,
      owner: { type: 'org', name: 'Field Operations', email: 'headof.field@wecga.co.th' }, orgName: 'Field Operations', orgHeadEmail: 'headof.field@wecga.co.th',
      lat: 18.7883, lng: 98.9853, district: 'Mueang', province: 'Chiang Mai',
      tagStatus: 'Tagged', countStatus: 'Not counted', area: 'NORTH', photos: mkPhotos(18.7883, 98.9853, 'Mueang', 'Chiang Mai') }),
  );

  /* Organization handover demo map (tagged, owner.type = org):
     General Admin       → HQ Bangkok / HQ Tower / 5F-MR1     (A-103 Whiteboard) + G-Loading (A-088,A-089) + 5F-Store (A-100)
     Cloud Implementation→ Cyber World / BF / BF001           (A-104 Router) + G-Loading (A-097,A-099) + 8F-Exec (A-101)
     IT Infrastructure   → HQ Bangkok / HQ Tower / 9F-IT      (A-105 Printer) + G-Loading (A-098)
     Field Operations    → North Field / CNX Depot / G / Yard (A-106 Rugged tablet)
     BB Field Ops        → BB Bangkok / BB Office / 2F        (A-096 VoIP) */

  assets.forEach(applyLoc);

  // Helper to build ticket history for parked steps
  function hist(flowKey, uptoIdx, startTs) {
    const flow = window.App.FLOWS[flowKey];
    const out = [];
    for (let i = 1; i <= uptoIdx; i++) {
      out.push({ ts: iso(2026, 1, 10 + i, 10, 0), actor: 'System / user', step: flow[i].title, note: '' });
    }
    return out;
  }

  const tickets = [
    // Tagging / first-record in progress
    { id: 'TK-0001', type: 'Tagging', flow: 'tagging', title: 'First-record tagging - Monitor Dell 27', assetId: 'A-006', company: 'AIS',
      status: 'In progress', stepIndex: 2, created: iso(2026, 1, 12), area: 'HQ Bangkok', history: hist('tagging', 2) },
    // Handover pending acceptance
    { id: 'TK-0002', type: 'Handover', flow: 'handover', title: 'Handover - IT kit to Wanida (monitor + notebook)', assetIds: ['A-015', 'A-090'], assetId: 'A-015', company: 'AIS',
      status: 'Awaiting acceptance', stepIndex: 1, channel: 'email', sendMode: 'owner', created: iso(2026, 1, 14), area: 'HQ Bangkok', history: hist('handover', 1) },
    // Handover multi-owner, partial accept demo
    { id: 'TK-0017', type: 'Handover', flow: 'handover', title: 'Handover - G-Loading batch (3 owners)', assetIds: ['A-086', 'A-088', 'A-092'], assetId: 'A-086', company: 'AIS',
      status: 'In progress', stepIndex: 1, channel: 'email', sendMode: 'owner', acceptedIds: ['A-086'],
      created: iso(2026, 1, 23), area: 'HQ Bangkok', history: hist('handover', 1) },
    // BB handover
    { id: 'TK-0018', type: 'Handover', flow: 'handover', title: 'Handover - BB office phones & labels', assetIds: ['A-095', 'A-096'], assetId: 'A-095', company: 'BB',
      status: 'Awaiting acceptance', stepIndex: 1, channel: 'wecga', sendMode: 'list', created: iso(2026, 1, 24), area: 'BB Bangkok', history: hist('handover', 1) },
    // Individual + Organization owners side-by-side (H3 demo)
    { id: 'TK-0019', type: 'Handover', flow: 'handover', title: 'Handover - Individual vs Organization (G-Loading)', assetIds: ['A-086', 'A-097', 'A-098', 'A-102'], assetId: 'A-086', company: 'AIS',
      status: 'Awaiting acceptance', stepIndex: 1, channel: 'email', sendMode: 'owner', created: iso(2026, 1, 25), area: 'HQ Bangkok', history: hist('handover', 1) },
    // Tagging complete — ready for handover demo (no handover yet)
    { id: 'TK-0022', type: 'Tagging', flow: 'tagging', title: 'Tagging complete - G-Loading org kit', assetIds: ['A-097', 'A-098'], assetId: 'A-097', company: 'AIS',
      status: 'Completed', stepIndex: 4, area: 'HQ Bangkok', assignedTo: 'G-Loading staging',
      created: iso(2026, 1, 24), history: hist('tagging', 4) },
    // Manual registration under 2000
    { id: 'TK-0003', type: 'Registration', flow: 'registration', title: 'Manual registration - Office Fan (< 2,000 THB)', assetId: 'A-007', company: 'AIS',
      subCase: 'under2000', status: 'Awaiting approval', stepIndex: 2, created: iso(2026, 1, 8), area: 'HQ Bangkok', history: hist('registration', 2) },
    // Re-registration of written-off asset
    { id: 'TK-0004', type: 'Registration', flow: 'registration', title: 'Re-register written-off laptop still in use', assetId: 'A-008', company: 'AIS',
      subCase: 'reregistered', status: 'Completed', stepIndex: 3, created: iso(2026, 1, 3), area: 'HQ Bangkok', history: hist('registration', 3) },
    // Transfer at approval (transferor side)
    { id: 'TK-0005', type: 'Transfer', flow: 'movement', title: 'Transfer Dell XPS 15 - Wanida to Kittipong', assetId: 'A-023', company: 'AIS',
      fromOwner: 'Wanida Employee', toOwner: 'Kittipong IT', status: 'Awaiting approval', stepIndex: 1, created: iso(2026, 1, 16), area: 'HQ Bangkok', history: hist('movement', 1) },
    // Transfer at receiver acceptance
    { id: 'TK-0006', type: 'Transfer', flow: 'movement', title: 'Transfer LG UltraWide - IT to Cloud Impl.', assetId: 'A-024', company: 'AIS',
      fromOwner: 'Kittipong IT', toOwner: 'Cloud Implementation', status: 'In progress', stepIndex: 4, created: iso(2026, 1, 11), area: 'HQ Bangkok', history: hist('movement', 4) },
    // Borrow
    { id: 'TK-0007', type: 'Borrow', flow: 'movement', title: 'Borrow portable projector for event', assetId: 'A-025', company: 'AIS',
      fromOwner: 'General Admin', toOwner: 'Wanida Employee', status: 'In progress', stepIndex: 3, created: iso(2026, 1, 18), area: 'HQ Bangkok', history: hist('movement', 3) },
    // Send for repair
    { id: 'TK-0008', type: 'Repair', flow: 'movement', title: 'Send MacBook Pro to vendor for repair', assetId: 'A-017', company: 'AIS',
      fromOwner: 'Kittipong IT', toOwner: 'Vendor - iStudio', status: 'In progress', stepIndex: 3, created: iso(2026, 1, 15), area: 'HQ Bangkok', history: hist('movement', 3) },
    // Loss - theft
    { id: 'TK-0009', type: 'Write-off Lost', flow: 'writeoffLost', title: 'Lost (theft) - iPad Pro at Chiang Mai depot', assetId: 'A-010', company: 'AIS',
      lossType: 'theft', status: 'Awaiting approval', stepIndex: 2, created: iso(2026, 1, 19), area: 'North Field', history: hist('writeoffLost', 2),
      attachments: ['Police daily record (copy)', 'POA + authorized signatory card'] },
    // Loss - unknown cause (resignation)
    { id: 'TK-0010', type: 'Write-off Lost', flow: 'writeoffLost', title: 'Lost (unknown) - employee resignation', assetId: 'A-020', company: 'AIS',
      lossType: 'unknown', unknownReason: 'resignation', status: 'In progress', stepIndex: 3, created: iso(2026, 1, 6), area: 'HQ Bangkok', history: hist('writeoffLost', 3),
      attachments: ['Supervisor memo'] },
    // Write-off sale at sub-committee
    { id: 'TK-0011', type: 'Write-off Sale', flow: 'writeoffSale', title: 'Write-off (sale) - damaged Cisco switch', assetId: 'A-009', company: 'AIS',
      status: 'In progress', stepIndex: 7, created: iso(2025, 12, 20), area: 'HQ Bangkok', history: hist('writeoffSale', 7),
      insuranceClaim: false, verify: { cause: 'Hardware failure, beyond repair', cost: 95000, nbv: 0, storage: '5F-Store cage B' } },
    // Write-off donation at committee
    { id: 'TK-0012', type: 'Write-off Donation', flow: 'writeoffDonation', title: 'Donate projector to local school', assetId: 'A-018', company: 'AIS',
      status: 'In progress', stepIndex: 4, created: iso(2025, 12, 28), area: 'HQ Bangkok', history: hist('writeoffDonation', 4),
      recipient: 'Wat Suan Kaew School' },
    // Write-off dispose — obsolete low-value asset
    { id: 'TK-0025', type: 'Write-off Dispose', flow: 'writeoffDispose', title: 'Dispose obsolete desk lamp (scrap)', assetId: 'A-019', company: 'AIS',
      status: 'In progress', stepIndex: 2, created: iso(2026, 1, 14), area: 'HQ Bangkok', history: hist('writeoffDispose', 2),
      disposeReason: 'Obsolete, no salvage value', disposeMethod: 'Licensed scrap vendor',
      verify: { cause: 'Obsolete, no salvage value', cost: 1200, nbv: 400, storage: '9F-IT store' } },
    // Count-derived transfer (wrong owner found on count)
    { id: 'TK-0013', type: 'Transfer', flow: 'movement', title: 'Count follow-up: correct holder of LG UltraWide', assetId: 'A-024', company: 'AIS',
      origin: 'count', fromOwner: 'Kittipong IT', toOwner: 'Cloud Implementation', status: 'Open', stepIndex: 0, created: iso(2026, 1, 21), area: 'HQ Bangkok', history: [] },
    // Count-derived store-return with no evidence -> compensation
    { id: 'TK-0014', type: 'Write-off Lost', flow: 'writeoffLost', title: 'Count follow-up: no return evidence, treat as lost', assetId: 'A-010', company: 'AIS',
      origin: 'count', lossType: 'unknown', unknownReason: 'no evidence from Store', status: 'Open', stepIndex: 0, created: iso(2026, 1, 21), area: 'North Field', history: [] },
  ];

  const cp2026Filter = { companies: ['AIS'], projects: ['HQ Bangkok'], buildings: ['HQ Tower'], floors: ['9F'], units: ['9F-IT'] };
  const cp2026Assigned = assets.filter(a => a.companyCode === 'AIS' && a.unit === '9F-IT' && a.project === 'HQ Bangkok').map(a => a.id);
  const cp2026Pkg = { id: 'PKG-1', key: 'AIS|HQ Bangkok|HQ Tower|9F|9F-IT', label: 'HQ Bangkok · HQ Tower · 9F · 9F-IT', assetIds: cp2026Assigned, teamRoles: ['it'] };
  const cpRoFilter = { companies: ['AIS'], projects: ['North Field'], buildings: ['CNX Depot'], floors: ['G'], units: ['Yard'] };
  const cpRoAssigned = ['A-004', 'A-010'];
  const cpRoPkg = { id: 'PKG-1', key: 'AIS|North Field|CNX Depot|G|Yard', label: 'North Field · CNX Depot · G · Yard', assetIds: cpRoAssigned, teamRoles: ['ga'] };
  const cp5fFilter = { companies: ['AIS'], projects: ['HQ Bangkok'], buildings: ['HQ Tower'], floors: ['5F'], units: ['5F-Store'] };
  const cp5fAssigned = assets.filter(a => a.companyCode === 'AIS' && a.unit === '5F-Store' && a.project === 'HQ Bangkok').map(a => a.id);
  const cp5fPkg = { id: 'PKG-1', key: 'AIS|HQ Bangkok|HQ Tower|5F|5F-Store', label: 'HQ Bangkok · HQ Tower · 5F · 5F-Store', assetIds: cp5fAssigned, teamRoles: ['ga'] };
  const countPlans = [
    { id: 'CP-2026', name: 'Annual Count 2026', type: 'location', company: 'AIS', companies: ['AIS'], status: 'In progress',
      start: iso(2026, 1, 15), end: iso(2026, 2, 15), scopeFilter: cp2026Filter, assignLevel: 'unit', workPackages: [cp2026Pkg],
      scopeDesc: 'By Asset Location: Companies: AIS; Projects: HQ Bangkok; Buildings: HQ Tower; Floors: 9F; Units: 9F-IT; Split at: unit',
      assignedAssets: cp2026Assigned },
    { id: 'CP-HQ-5F', name: 'HQ 5F Store count', type: 'location', company: 'AIS', companies: ['AIS'], status: 'Planned',
      start: iso(2026, 2, 10), end: iso(2026, 2, 20), scopeFilter: cp5fFilter, assignLevel: 'unit', workPackages: [cp5fPkg],
      scopeDesc: 'By Asset Location: Companies: AIS; Projects: HQ Bangkok; Buildings: HQ Tower; Floors: 5F; Units: 5F-Store; Split at: unit',
      assignedAssets: cp5fAssigned },
    { id: 'CP-RO-01', name: 'RO Round - North depot', type: 'location', company: 'AIS', companies: ['AIS'], status: 'Planned',
      start: iso(2026, 2, 1), end: iso(2026, 2, 5), scopeFilter: cpRoFilter, assignLevel: 'unit', workPackages: [cpRoPkg],
      scopeDesc: 'By Asset Location: Companies: AIS; Projects: North Field; Buildings: CNX Depot; Floors: G; Units: Yard; Split at: unit',
      assignedAssets: cpRoAssigned },
  ];

  // count results feeding reconciliation + the 6 outcomes
  const countResults = [
    { id: 'CR-01', planId: 'CP-2026', assetId: 'A-001', outcome: 'found_ok', by: 'U-004', date: iso(2026, 1, 20), note: '' },
    { id: 'CR-02', planId: 'CP-2026', assetId: 'A-024', outcome: 'found_wrong', by: 'U-004', date: iso(2026, 1, 21), note: 'Holder should be Cloud Implementation, not IT', spawnedTicket: 'TK-0013' },
    { id: 'CR-03', planId: 'CP-2026', assetId: 'A-009', outcome: 'found_damaged', by: 'U-006', date: iso(2026, 1, 20), note: 'Chassis burnt, beyond repair', spawnedTicket: 'TK-0011' },
    { id: 'CR-04', planId: 'CP-2026', assetId: 'A-010', outcome: 'not_found', by: 'U-010', date: iso(2026, 1, 19), note: 'Not present at depot; claimed returned to Store but no evidence', spawnedTicket: 'TK-0014' },
    { id: 'CR-05', planId: 'CP-2026', assetId: 'A-017', outcome: 'moved', by: 'U-005', date: iso(2026, 1, 22), note: 'Sent to vendor for repair - evidence: email attached', evidence: true },
  ];

  const purchaseOrders = [
    { po: 'PO-4500091231', vendor: '\u0e1a\u0e08. Dell TH', item: 'Monitor Dell 27" U2723QE', qty: 1, company: 'AIS', delivery: 'Delivered - GR pending', createdAssets: ['A-006'] },
    { po: 'PO-4500091190', vendor: '\u0e1a\u0e08. ABC', item: 'Firewall Fortinet FG-100F', qty: 1, company: 'AIS', delivery: 'Delivered - GR pending', createdAssets: ['A-078'] },
    { po: 'PO-4500091255', vendor: '\u0e1a\u0e08. HP TH', item: 'Notebook HP EliteBook 840 G10', qty: 5, company: 'AIS', delivery: 'Delivered - GR pending', createdAssets: ['A-079', 'A-080', 'A-081', 'A-082', 'A-083'] },
    { po: 'PO-4500091288', vendor: '\u0e1a\u0e08. Lenovo TH', item: 'Desktop Lenovo ThinkCentre M90', qty: 3, company: 'AIS', delivery: 'In transit' },
    { po: 'PO-4500091310', vendor: '\u0e1a\u0e08. Cisco TH', item: 'Switch Cisco Catalyst 9200', qty: 2, company: 'AIS', delivery: 'Ordered' },
    { po: 'PO-4500091260', vendor: '\u0e1a\u0e08. Fiber TH', item: 'ONT Router GPON', qty: 10, company: 'BB', delivery: 'Delivered - GR pending', createdAssets: ['A-012'] },
    { po: 'PO-4500091299', vendor: '\u0e1a\u0e08. Huawei TH', item: 'Switch Huawei S5720 (field kit)', qty: 2, company: 'BB', delivery: 'Delivered - GR pending', createdAssets: ['A-084', 'A-085'] },
    { po: 'PO-4500091277', vendor: '\u0e1a\u0e08. Toyota', item: 'Service Van Toyota Hiace', qty: 1, company: 'BB', delivery: 'In transit' },
  ];

  const sapLog = [
    { id: 'SAP-01', dir: 'inbound', ts: iso(2026, 1, 5, 8, 0), type: 'Asset master create', ref: '715000020110', status: 'Processed', detail: 'New asset from Accounting (GR posted)' },
    { id: 'SAP-02', dir: 'inbound', ts: iso(2026, 1, 5, 8, 1), type: 'PR/PO', ref: 'PO-4500091231', status: 'Processed', detail: 'PO delivered, GR pending appointment' },
    { id: 'SAP-06', dir: 'inbound', ts: iso(2026, 1, 18, 9, 0), type: 'Asset master create', ref: '715000020220', status: 'Processed', detail: 'FG-100F from PO-4500091190 (Accounting)' },
    { id: 'SAP-07', dir: 'inbound', ts: iso(2026, 1, 20, 10, 0), type: 'Asset master create', ref: '715000020331', status: 'Processed', detail: '5x EliteBook from PO-4500091255 batch' },
    { id: 'SAP-08', dir: 'inbound', ts: iso(2026, 1, 22, 11, 0), type: 'Asset master create', ref: '715000030550', status: 'Processed', detail: '2x Huawei switch from PO-4500091299 (BB)' },
    { id: 'SAP-03', dir: 'outbound', ts: iso(2026, 1, 16, 14, 0), type: 'Owner/location update', ref: '715000018080', status: 'Queued', detail: 'Transfer TK-0006 pending SAP update' },
    { id: 'SAP-04', dir: 'outbound', ts: iso(2025, 12, 30, 16, 0), type: 'Write-off / retire', ref: '715000015500', status: 'Pending committee', detail: 'Sale write-off TK-0011' },
    { id: 'SAP-05', dir: 'inbound', ts: iso(2026, 1, 1, 2, 0), type: 'Nightly master sync', ref: 'BATCH-20260101', status: 'Processed', detail: '1,240 asset records reconciled' },
  ];

  const audit = [
    { ts: iso(2026, 1, 22, 11, 30), actor: 'Kittipong IT', action: 'Count recorded', target: 'A-017', detail: 'Outcome: moved (repair)' },
    { ts: iso(2026, 1, 21, 15, 5), actor: 'Wanida Employee', action: 'Count recorded', target: 'A-024', detail: 'Outcome: found - wrong holder' },
    { ts: iso(2026, 1, 21, 15, 6), actor: 'System', action: 'Spawn transfer', target: 'TK-0013', detail: 'From count CR-02' },
    { ts: iso(2026, 1, 20, 9, 0), actor: 'Somchai Asset (HQ)', action: 'QR generated', target: 'A-006', detail: 'Company AIS' },
    { ts: iso(2026, 1, 19, 16, 45), actor: 'Chalermsak GA-North', action: 'Count recorded', target: 'A-010', detail: 'Outcome: not found' },
    { ts: iso(2026, 1, 16, 14, 0), actor: 'Somchai Asset (HQ)', action: 'Transfer approved (transferor)', target: 'TK-0006', detail: '' },
  ];

  window.App.setStore({
    assets, tickets, countPlans, countResults, users, sites, sapLog, audit, purchaseOrders,
    seq: { TK: 22, A: 107, CP: 3, WECGA: 4 },
  });
})();
