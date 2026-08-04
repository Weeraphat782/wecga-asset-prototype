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
    { id: 'U-002', name: 'Nadia GA-BKK', role: 'ga', email: 'nadia.g@wecga.co.th', org: 'GA Bangkok', company: 'AIS', area: 'BKK' },
    { id: 'U-003', name: 'Preecha Accounting', role: 'accounting', email: 'preecha.acc@wecga.co.th', org: 'Accounting', company: 'AIS' },
    { id: 'U-004', name: 'Wanida Employee', role: 'employee', email: 'wanida.e@wecga.co.th', org: 'Cloud Implementation', company: 'AIS' },
    { id: 'U-005', name: 'Kittipong IT', role: 'it', email: 'kittipong.it@wecga.co.th', org: 'IT Infrastructure', company: 'AIS' },
    { id: 'U-006', name: 'Arthit Network Eng.', role: 'engineer', email: 'arthit.eng@wecga.co.th', org: 'Network Engineering', company: 'AIS' },
    { id: 'U-007', name: 'Malee Store', role: 'store', email: 'malee.store@wecga.co.th', org: 'Central Store', company: 'AIS' },
    { id: 'U-008', name: 'Committee Chair', role: 'committee', email: 'committee@wecga.co.th', org: 'Disposal Committee', company: 'AIS' },
    { id: 'U-009', name: 'Executive Viewer', role: 'exec', email: 'exec@wecga.co.th', org: 'Executive', company: 'AIS' },
    { id: 'U-010', name: 'Chalpermsak GA-North', role: 'ga', email: 'chalermsak.g@wecga.co.th', org: 'GA North', company: 'AIS', area: 'North' },
    { id: 'U-011', name: 'Suda Employee (BB)', role: 'employee', email: 'suda.e@bb.co.th', org: 'Field Ops', company: 'BB' },
  ];

  // GA areas: AIS 6, BB 10
  const areas = [
    { company: 'AIS', code: 'BKK', name: 'Bangkok Metro' },
    { company: 'AIS', code: 'CENTRAL', name: 'Central' },
    { company: 'AIS', code: 'NORTH', name: 'North' },
    { company: 'AIS', code: 'NORTHEAST', name: 'Northeast' },
    { company: 'AIS', code: 'EAST', name: 'East' },
    { company: 'AIS', code: 'SOUTH', name: 'South' },
    { company: 'BB', code: 'BB01', name: 'BB Area 01 - Bangkok' },
    { company: 'BB', code: 'BB02', name: 'BB Area 02 - Nonthaburi' },
    { company: 'BB', code: 'BB03', name: 'BB Area 03 - Chiang Mai' },
    { company: 'BB', code: 'BB04', name: 'BB Area 04 - Khon Kaen' },
    { company: 'BB', code: 'BB05', name: 'BB Area 05 - Chonburi' },
    { company: 'BB', code: 'BB06', name: 'BB Area 06 - Rayong' },
    { company: 'BB', code: 'BB07', name: 'BB Area 07 - Phuket' },
    { company: 'BB', code: 'BB08', name: 'BB Area 08 - Hat Yai' },
    { company: 'BB', code: 'BB09', name: 'BB Area 09 - Nakhon Ratchasima' },
    { company: 'BB', code: 'BB10', name: 'BB Area 10 - Udon Thani' },
  ];

  // Base defaults matching the page-11 SAP example, overridden per asset.
  const base = {
    company: '2900', assetClass: '7150', assetClassDesc: 'Data Network Equip.',
    sno: '0', quantity: 1, baseUnit: 'EA', wbs: '', manufacturer: '',
    usefulLifePeriod: '', trPrt: '', typeName: '', warranty: '',
    room: '', eva4: '', eva4Desc: '', evGrp5: '', eva5Desc: '',
    companyCode: 'AIS', source: 'SAP', tagStatus: 'Tagged',
    countStatus: 'Not counted', photos: [],
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
      warranty: '2027-06', tagStatus: 'Tagged', countStatus: 'Found', lastCountDate: iso(2026, 1, 21), area: 'BKK' }),
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
      tagStatus: 'Tagged', countStatus: 'Found', lastCountDate: iso(2026, 1, 19), area: 'NORTH' }),
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
      tagStatus: 'Not tagged', countStatus: 'Not counted', area: 'BKK' }),
    // 7 - manual WeCGA asset under 2000 THB (no SAP code)
    A({ id: 'A-007', asset: '', wecgaCode: 'WECGA-AIS-000001', source: 'WeCGA', assetClass: '9000', assetClassDesc: 'Low-value (< 2,000)',
      capDate: iso(2025, 9, 12), desc1: 'Office Fan', desc2: 'Hatari 16"',
      costCenter: '29013300', costCenterName: 'General Admin', serial: 'HT-16-3321',
      cost: 690, accum: 0, nbv: 690, location: '110610100N', locationDesc: 'ABC_BKK_HQ_5F', room: '5F-A',
      vendor: '', vendorName: '', usefulLifeYear: 3, brand: 'Hatari', model: 'HT-16',
      owner: { type: 'person', name: 'Wanida Employee', email: 'wanida.e@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok',
      tagStatus: 'Tagged', countStatus: 'Found', lastCountDate: iso(2026, 1, 22), area: 'BKK' }),
    // 8 - re-registered asset (written off in SAP but still in use)
    A({ id: 'A-008', asset: '', wecgaCode: 'WECGA-AIS-000002', source: 'reregistered', assetClass: '7200', assetClassDesc: 'IT Equipment',
      capDate: iso(2016, 4, 1), desc1: 'Notebook Lenovo (written off)', desc2: 'ThinkPad T460',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'LNV-T460-0087',
      cost: 38000, accum: -38000, nbv: 0, location: '110610100N', locationDesc: 'ABC_BKK_HQ_9F', room: '9F-IT',
      vendor: '', vendorName: '', usefulLifeYear: 4, brand: 'Lenovo', model: 'ThinkPad T460',
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
      tagStatus: 'Tagged', countStatus: 'Not found', lastCountDate: iso(2026, 1, 19), area: 'NORTH' }),
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
      tagStatus: 'Not tagged', countStatus: 'Not counted', area: 'BB03' }),
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
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok', tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK' }),
    // 18 - donation candidate (old but working projector)
    A({ id: 'A-018', asset: '715000012200', municipality: '000033012200-0000', assetClass: '7250', assetClassDesc: 'Office Equipment', capDate: iso(2017, 6, 1), desc1: 'Projector Epson', desc2: 'EB-2250U',
      costCenter: '29013300', costCenterName: 'General Admin', serial: 'EPB2250-0912', cost: 26000, accum: -26000, nbv: 0,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_5F', room: '5F-MR1', vendor: '6100002210', vendorName: '\u0e1a\u0e08. Office Plus', usefulLifeYear: 6, brand: 'Epson', model: 'EB-2250U',
      owner: { type: 'org', name: 'General Admin', email: 'headof.ga@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok', tagStatus: 'Tagged', countStatus: 'Found', lastCountDate: iso(2026, 1, 22), area: 'BKK' }),
    // 19-20 - low-value manual mass-created batch
    A({ id: 'A-019', asset: '', wecgaCode: 'WECGA-AIS-000003', source: 'WeCGA', assetClass: '9000', assetClassDesc: 'Low-value (< 2,000)', capDate: iso(2025, 10, 1), desc1: 'Desk Lamp', desc2: 'LED',
      costCenter: '29013300', costCenterName: 'General Admin', serial: 'LMP-LED-0021', cost: 450, accum: 0, nbv: 450,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_5F', room: '5F-A', usefulLifeYear: 3, brand: 'Philips', model: 'LED Desk',
      owner: { type: 'org', name: 'General Admin', email: 'headof.ga@wecga.co.th' },
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok', tagStatus: 'Not tagged', countStatus: 'Not counted', area: 'BKK' }),
    A({ id: 'A-020', asset: '', wecgaCode: 'WECGA-AIS-000004', source: 'WeCGA', assetClass: '9000', assetClassDesc: 'Low-value (< 2,000)', capDate: iso(2025, 10, 1), desc1: 'Keyboard Logitech', desc2: 'MX Keys',
      costCenter: '29011002', costCenterName: 'IT Infrastructure', serial: 'LGMX-0451', cost: 1900, accum: 0, nbv: 1900,
      location: '110610100N', locationDesc: 'ABC_BKK_HQ_9F', room: '9F-IT', usefulLifeYear: 3, brand: 'Logitech', model: 'MX Keys',
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
      lat: 13.7563, lng: 100.5018, district: 'Pathum Wan', province: 'Bangkok', tagStatus: 'Tagged', countStatus: 'Not counted', area: 'BKK' }),
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
      status: 'In progress', stepIndex: 2, created: iso(2026, 1, 12), area: 'BKK', history: hist('tagging', 2) },
    // Handover pending acceptance
    { id: 'TK-0002', type: 'Handover', flow: 'handover', title: 'Handover - Notebook HP EliteBook to Wanida', assetId: 'A-015', company: 'AIS',
      status: 'Awaiting acceptance', stepIndex: 1, created: iso(2026, 1, 14), area: 'BKK', history: hist('handover', 1) },
    // Manual registration under 2000
    { id: 'TK-0003', type: 'Registration', flow: 'registration', title: 'Manual registration - Office Fan (< 2,000 THB)', assetId: 'A-007', company: 'AIS',
      subCase: 'under2000', status: 'Awaiting approval', stepIndex: 2, created: iso(2026, 1, 8), area: 'BKK', history: hist('registration', 2) },
    // Re-registration of written-off asset
    { id: 'TK-0004', type: 'Registration', flow: 'registration', title: 'Re-register written-off laptop still in use', assetId: 'A-008', company: 'AIS',
      subCase: 'reregistered', status: 'Completed', stepIndex: 3, created: iso(2026, 1, 3), area: 'BKK', history: hist('registration', 3) },
    // Transfer at approval (transferor side)
    { id: 'TK-0005', type: 'Transfer', flow: 'movement', title: 'Transfer Dell XPS 15 - Wanida to Kittipong', assetId: 'A-023', company: 'AIS',
      fromOwner: 'Wanida Employee', toOwner: 'Kittipong IT', status: 'Awaiting approval', stepIndex: 1, created: iso(2026, 1, 16), area: 'BKK', history: hist('movement', 1) },
    // Transfer at receiver acceptance
    { id: 'TK-0006', type: 'Transfer', flow: 'movement', title: 'Transfer LG UltraWide - IT to Cloud Impl.', assetId: 'A-024', company: 'AIS',
      fromOwner: 'Kittipong IT', toOwner: 'Cloud Implementation', status: 'In progress', stepIndex: 4, created: iso(2026, 1, 11), area: 'BKK', history: hist('movement', 4) },
    // Borrow
    { id: 'TK-0007', type: 'Borrow', flow: 'movement', title: 'Borrow portable projector for event', assetId: 'A-025', company: 'AIS',
      fromOwner: 'General Admin', toOwner: 'Wanida Employee', status: 'In progress', stepIndex: 3, created: iso(2026, 1, 18), area: 'BKK', history: hist('movement', 3) },
    // Send for repair
    { id: 'TK-0008', type: 'Repair', flow: 'movement', title: 'Send MacBook Pro to vendor for repair', assetId: 'A-017', company: 'AIS',
      fromOwner: 'Kittipong IT', toOwner: 'Vendor - iStudio', status: 'In progress', stepIndex: 3, created: iso(2026, 1, 15), area: 'BKK', history: hist('movement', 3) },
    // Loss - theft
    { id: 'TK-0009', type: 'Write-off Lost', flow: 'writeoffLost', title: 'Lost (theft) - iPad Pro at Chiang Mai depot', assetId: 'A-010', company: 'AIS',
      lossType: 'theft', status: 'Awaiting approval', stepIndex: 2, created: iso(2026, 1, 19), area: 'NORTH', history: hist('writeoffLost', 2),
      attachments: ['Police daily record (copy)', 'POA + authorized signatory card'] },
    // Loss - unknown cause (resignation)
    { id: 'TK-0010', type: 'Write-off Lost', flow: 'writeoffLost', title: 'Lost (unknown) - employee resignation', assetId: 'A-020', company: 'AIS',
      lossType: 'unknown', unknownReason: 'resignation', status: 'In progress', stepIndex: 3, created: iso(2026, 1, 6), area: 'BKK', history: hist('writeoffLost', 3),
      attachments: ['Supervisor memo'] },
    // Write-off sale at sub-committee
    { id: 'TK-0011', type: 'Write-off Sale', flow: 'writeoffSale', title: 'Write-off (sale) - damaged Cisco switch', assetId: 'A-009', company: 'AIS',
      status: 'In progress', stepIndex: 7, created: iso(2025, 12, 20), area: 'BKK', history: hist('writeoffSale', 7),
      insuranceClaim: false, verify: { cause: 'Hardware failure, beyond repair', cost: 95000, nbv: 0, storage: '5F-Store cage B' } },
    // Write-off donation at committee
    { id: 'TK-0012', type: 'Write-off Donation', flow: 'writeoffDonation', title: 'Donate projector to local school', assetId: 'A-018', company: 'AIS',
      status: 'In progress', stepIndex: 4, created: iso(2025, 12, 28), area: 'BKK', history: hist('writeoffDonation', 4),
      recipient: 'Wat Suan Kaew School' },
    // Count-derived transfer (wrong owner found on count)
    { id: 'TK-0013', type: 'Transfer', flow: 'movement', title: 'Count follow-up: correct holder of LG UltraWide', assetId: 'A-024', company: 'AIS',
      origin: 'count', fromOwner: 'Kittipong IT', toOwner: 'Cloud Implementation', status: 'Open', stepIndex: 0, created: iso(2026, 1, 21), area: 'BKK', history: [] },
    // Count-derived store-return with no evidence -> compensation
    { id: 'TK-0014', type: 'Write-off Lost', flow: 'writeoffLost', title: 'Count follow-up: no return evidence, treat as lost', assetId: 'A-010', company: 'AIS',
      origin: 'count', lossType: 'unknown', unknownReason: 'no evidence from Store', status: 'Open', stepIndex: 0, created: iso(2026, 1, 21), area: 'NORTH', history: [] },
  ];

  const countPlans = [
    { id: 'CP-2026', name: 'Annual Count 2026', type: 'annual', company: 'AIS', status: 'In progress',
      start: iso(2026, 1, 15), end: iso(2026, 2, 15), scopeDesc: 'Nationwide, all assets, simultaneous',
      assignedAssets: assets.filter(a => a.companyCode === 'AIS').map(a => a.id) },
    { id: 'CP-RO-01', name: 'Ad-hoc RO Round - North depot', type: 'adhoc', company: 'AIS', status: 'Planned',
      start: iso(2026, 2, 1), end: iso(2026, 2, 5), scope: 'location', scopeDesc: 'Location: Chiang Mai depot (RO special round, independent of annual)',
      assignedAssets: ['A-004', 'A-010'] },
  ];

  // count results feeding reconciliation + the 6 outcomes
  const countResults = [
    { id: 'CR-01', planId: 'CP-2026', assetId: 'A-001', outcome: 'found_ok', by: 'U-004', date: iso(2026, 1, 20), note: '' },
    { id: 'CR-02', planId: 'CP-2026', assetId: 'A-024', outcome: 'found_wrong', by: 'U-004', date: iso(2026, 1, 21), note: 'Holder should be Cloud Implementation, not IT', spawnedTicket: 'TK-0013' },
    { id: 'CR-03', planId: 'CP-2026', assetId: 'A-009', outcome: 'found_damaged', by: 'U-006', date: iso(2026, 1, 20), note: 'Chassis burnt, beyond repair', spawnedTicket: 'TK-0011' },
    { id: 'CR-04', planId: 'CP-2026', assetId: 'A-010', outcome: 'not_found', by: 'U-010', date: iso(2026, 1, 19), note: 'Not present at depot; claimed returned to Store but no evidence', spawnedTicket: 'TK-0014' },
    { id: 'CR-05', planId: 'CP-2026', assetId: 'A-017', outcome: 'moved', by: 'U-005', date: iso(2026, 1, 22), note: 'Sent to vendor for repair - evidence: email attached', evidence: true },
  ];

  const sapLog = [
    { id: 'SAP-01', dir: 'inbound', ts: iso(2026, 1, 5, 8, 0), type: 'Asset master create', ref: '715000020110', status: 'Processed', detail: 'New asset from Accounting (GR posted)' },
    { id: 'SAP-02', dir: 'inbound', ts: iso(2026, 1, 5, 8, 1), type: 'PR/PO', ref: 'PO-4500091231', status: 'Processed', detail: 'PO delivered, GR pending appointment' },
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
    assets, tickets, countPlans, countResults, users, areas, sapLog, audit,
    seq: { TK: 14, A: 25, CP: 2, WECGA: 4 },
  });
})();
