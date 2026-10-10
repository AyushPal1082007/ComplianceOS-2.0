/**
 * ComplianceOS — VEDA Document Fixtures & Samples
 * Realistic Indian MSME document OCR samples including GST certificates,
 * Udyam certificates, GST notices, challans, licences, Hindi text, and noisy OCR.
 */

export const FIXTURES = {
  // 1. Valid GST Certificate
  gst_cert_valid: {
    docType: 'GST_CERTIFICATE',
    ocrText: `GOVERNMENT OF INDIA
FORM GST REG-06
REGISTRATION CERTIFICATE
Registration Number: 09AAECP1234F1ZP
1. Legal Name: SHARMA ENTERPRISES PRIVATE LIMITED
2. Trade Name: SHARMA SWEETS & BAKERS
3. Constitution of Business: Private Limited Company
4. Address of Principal Place of Business:
Shop No. 12, Main Market, Hazratganj, Lucknow, Uttar Pradesh, 226001
5. Date of Liability: 01/04/2024
6. Period of Validity: From 01/04/2024 To Permanent
7. Type of Registration: Regular
8. Particulars of Approving Authority: State Tax Officer, Lucknow
Date of issue of Certificate: 05/04/2024`,
    expected: {
      gstin: '09AAECP1234F1ZP',
      legalName: 'SHARMA ENTERPRISES PRIVATE LIMITED',
      tradeName: 'SHARMA SWEETS & BAKERS',
      state: 'Uttar Pradesh',
      constitution: 'Private Limited Company',
      dateOfRegistration: '05/04/2024',
    },
  },

  // 2. GST Certificate with mismatched state (GSTIN 27 = Maharashtra, but address Kanpur UP)
  gst_cert_mismatch_state: {
    docType: 'GST_CERTIFICATE',
    ocrText: `GOVERNMENT OF INDIA
FORM GST REG-06
REGISTRATION CERTIFICATE
Registration Number: 27AAECP1234F1ZR
1. Legal Name: GUPTA TRADERS
2. Trade Name: GUPTA TRADERS
3. Constitution of Business: Sole Proprietorship
4. Address: 45 Mall Road, Kanpur, Uttar Pradesh, 208001
Date of issue: 12/05/2023`,
    expected: {
      gstin: '27AAECP1234F1ZR',
      legalName: 'GUPTA TRADERS',
    },
  },

  // 3. Udyam Registration Certificate
  udyam_cert_valid: {
    docType: 'UDYAM_CERTIFICATE',
    ocrText: `BHARAT SARKAR
MINISTRY OF MICRO, SMALL & MEDIUM ENTERPRISES
UDYAM REGISTRATION CERTIFICATE
UDYAM REGISTRATION NUMBER: UDYAM-UP-28-0012345
NAME OF ENTERPRISE: VERMA PLASTICS MANUFACTURING
TYPE OF ENTERPRISE: MICRO
MAJOR ACTIVITY: MANUFACTURING
NATIONAL INDUSTRY CLASSIFICATION (NIC) CODE: 22209
NAME OF UNIT: VERMA PLASTICS
DATE OF INCORPORATION / REGISTRATION: 15/08/2021
DATE OF UDYAM REGISTRATION: 20/08/2021
DISTRICT: KANPUR NAGAR, STATE: UTTAR PRADESH`,
    expected: {
      udyamNumber: 'UDYAM-UP-28-0012345',
      enterpriseName: 'VERMA PLASTICS MANUFACTURING',
      enterpriseType: 'micro',
      district: 'KANPUR NAGAR',
      state: 'UTTAR PRADESH',
      dateOfRegistration: '20/08/2021',
    },
  },

  // 4. GST Notice / Demand (DRC-01)
  gst_notice_demand: {
    docType: 'GST_NOTICE',
    ocrText: `OFFICE OF THE ASSISTANT COMMISSIONER OF STATE TAX
SECTOR 4, COMMERCIAL TAX DEPARTMENT, NOIDA
FORM GST DRC-01
[See rule 142(1)]
Summary of Show Cause Notice under Section 73
Notice Reference No: SCN/GST/NOIDA/2025/8971
Date of Notice: 10/01/2025
To GSTIN: 09AAECP1234F1ZP
M/s SHARMA ENTERPRISES PRIVATE LIMITED
Tax Period: FY 2022-23 (April 2022 to March 2023)
Discrepancy in ITC claimed in GSTR-3B vs GSTR-2B.
Total Tax Demanded: Rs. 45,000.00
Interest under Section 50: Rs. 8,100.00
Penalty under Section 73(9): Rs. 4,500.00
Total Amount Demanded: 57,600.00
You are hereby directed to submit your reply by 10/02/2025.`,
    expected: {
      noticeType: 'Show Cause Notice under Section 73',
      section: 'Section 73',
      issuingOffice: 'COMMERCIAL TAX DEPARTMENT, NOIDA',
      dateOfNotice: '10/01/2025',
      replyDueDate: '10/02/2025',
      amountDemanded: 57600,
      gstin: '09AAECP1234F1ZP',
    },
  },

  // 5. Challan Acknowledgement (PMT-06)
  challan_ack_valid: {
    docType: 'CHALLAN_ACK',
    ocrText: `GOODS AND SERVICES TAX
CHALLAN IDENTIFICATION NUMBER (CIN): 00010901202500098765
FORM GST PMT-06
Challan for deposit of Goods and Services Tax
CPIN: 25010900123456
Deposit Date: 15/01/2025
Payment Mode: Net Banking
GSTIN: 09AAECP1234F1ZP
Tax Period: December 2024
Total Amount Paid: Rs. 18,500.00
Status: Paid / Successful
Return Filed: GSTR-3B ARN AA0912240019283`,
    expected: {
      returnType: 'GSTR-3B',
      amountPaid: 18500,
      dateFiled: '15/01/2025',
      period: 'December 2024',
    },
  },

  // 6. Food Licence (FSSAI)
  fssai_licence_valid: {
    docType: 'LICENCE_INVOICE',
    ocrText: `FOOD SAFETY AND STANDARDS AUTHORITY OF INDIA
REGISTRATION CERTIFICATE UNDER FSSAI ACT, 2006
Registration No: 22723105000123
1. Name of Food Business Operator: AGARWAL SWEET HOUSE
2. Address: 14 Chowk Bazaar, Varanasi, Uttar Pradesh - 221001
3. Kind of Business: Dairy, Sweet Shop & Snacks
4. Period of Validity:
Valid From: 01/01/2024
Valid To: 31/12/2028
Issuing Authority: Food Safety Officer, Varanasi`,
    expected: {
      licenceType: 'FSSAI Registration',
      number: '22723105000123',
      validFrom: '01/01/2024',
      validTo: '31/12/2028',
      issuingAuthority: 'Food Safety Officer, Varanasi',
    },
  },

  // 7. Hindi text document (Udyam in Hindi/Bilingual)
  hindi_udyam_sample: {
    docType: 'UDYAM_CERTIFICATE',
    ocrText: `भारत सरकार
सूक्ष्म, लघु एवं मध्यम उद्यम मंत्रालय
उद्यम पंजीकरण प्रमाण पत्र
UDYAM REGISTRATION CERTIFICATE
उद्यम पंजीकरण संख्या: UDYAM-UP-28-0099881
इकाई का नाम: किसान एग्रो प्रोडक्ट्स
उद्यम का प्रकार: MICRO
पंजीकरण की तिथि: 12/03/2023
राज्य: UTTAR PRADESH
जिला: KANPUR DEHAT`,
    expected: {
      udyamNumber: 'UDYAM-UP-28-0099881',
      enterpriseName: 'किसान एग्रो प्रोडक्ट्स',
      enterpriseType: 'micro',
      state: 'UTTAR PRADESH',
      district: 'KANPUR DEHAT',
      dateOfRegistration: '12/03/2023',
    },
  },

  // 8. Noisy OCR sample (smudged / scanned)
  noisy_ocr_gst_cert: {
    docType: 'GST_CERTIFICATE',
    ocrText: `GOVT 0F 1NDIA
F0RM GST REG-06
REG1STRAT10N CERT1F1CATE
Reg. No.: 09AAECP1234F1ZP
Legal Name: SHARMA ENTERPRISES PVT LTD
Trade Name: SHARMA SWEETS
Constituti0n: Private Limited Company
Address: Hazratganj Lucknow UP 226001
Date of Certificate: 05/04/2024`,
    expected: {
      gstin: '09AAECP1234F1ZP',
      legalName: 'SHARMA ENTERPRISES PVT LTD',
      tradeName: 'SHARMA SWEETS',
    },
  },

  // 9. Document containing Aadhaar number to verify masking
  aadhaar_containing_doc: {
    docType: 'UDYAM_CERTIFICATE',
    ocrText: `UDYAM REGISTRATION CERTIFICATE
UDYAM REGISTRATION NUMBER: UDYAM-UP-28-0055443
Aadhaar Number of Entrepreneur: 5432 8765 1234
Name: RAMESH KUMAR VERMA
Date of Registration: 18/06/2022
State: UTTAR PRADESH`,
    expected: {
      udyamNumber: 'UDYAM-UP-28-0055443',
    },
  },

  // 10. Empty / blurry photo
  empty_blurry_photo: {
    docType: 'UNKNOWN',
    ocrText: `BLURRY ...`,
    expected: null,
  },
};

export default FIXTURES;
