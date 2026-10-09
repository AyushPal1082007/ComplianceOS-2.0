'use strict';
/**
 * ComplianceOS — PATHWAY Agent (Process and Action Tracker with Help for You)
 * Generates checklists with official deep links — no login, no auto-filing
 * Per PDF Section 7: "Step list + official portal link; No login. No auto-filing."
 */

// ── Official Deep Links (curated, per PDF) ────────────────────────────────────
const OFFICIAL_LINKS = {
  gst_portal: 'https://gst.gov.in',
  gst_return_filing: 'https://return.gst.gov.in/returns/auth',
  gst_registration: 'https://reg.gst.gov.in/registration/',
  gst_challan: 'https://payments.gst.gov.in/gstpayment/',
  udyam_registration: 'https://udyamregistration.gov.in',
  udyam_assistance: 'https://udyamassist.gov.in',
  income_tax: 'https://www.incometax.gov.in',
  traces_tds: 'https://www.tdscpc.gov.in',
  mca: 'https://www.mca.gov.in',
  epfo: 'https://www.epfindia.gov.in',
  esic: 'https://www.esic.in',
  fssai: 'https://foscos.fssai.gov.in',
  dgft: 'https://www.dgft.gov.in',
  msme_samadhaan: 'https://samadhaan.msme.gov.in',
  mudra: 'https://mudra.org.in',
  standup_india: 'https://www.standupmitra.in',
  cgtmse: 'https://cgtmse.in',
  pmegp: 'https://kviconline.gov.in/pmegpeportal',
  up_msme: 'https://msme1connect.up.gov.in',
  gst_notices: 'https://notices.gst.gov.in',
};

// ── Pathway Templates ─────────────────────────────────────────────────────────

const PATHWAY_TEMPLATES = {
  gst_return: {
    title: 'GST Return Filing',
    titleHindi: 'GST रिटर्न दाखिल करना',
    steps: [
      {
        stepNumber: 1,
        title: 'Login to GST Portal',
        titleHindi: 'GST पोर्टल पर लॉगिन करें',
        description: 'Go to gst.gov.in and login with your GSTIN and password',
        descriptionHindi: 'gst.gov.in पर जाएं और अपने GSTIN और पासवर्ड से लॉगिन करें',
        officialUrl: OFFICIAL_LINKS.gst_portal,
        documents: ['GSTIN', 'Password'],
        isRequired: true,
      },
      {
        stepNumber: 2,
        title: 'File GSTR-1 (Sales Return)',
        titleHindi: 'GSTR-1 (बिक्री रिटर्न) दाखिल करें',
        description: 'Upload your B2B and B2C sales invoices. Due by 11th of following month for monthly filers.',
        descriptionHindi: 'अपने B2B और B2C बिक्री चालान अपलोड करें। मासिक फाइलर के लिए अगले महीने की 11 तारीख तक देय।',
        officialUrl: OFFICIAL_LINKS.gst_return_filing,
        documents: ['Sales invoices for the period'],
        isRequired: true,
        dueDay: 11,
      },
      {
        stepNumber: 3,
        title: 'File GSTR-3B (Summary Return)',
        titleHindi: 'GSTR-3B (सारांश रिटर्न) दाखिल करें',
        description: 'File summary return with net tax payable. Due by 20th for monthly filers. Pay any tax before filing.',
        descriptionHindi: 'शुद्ध देय कर के साथ सारांश रिटर्न दाखिल करें। मासिक फाइलर के लिए 20 तारीख तक देय।',
        officialUrl: OFFICIAL_LINKS.gst_return_filing,
        documents: ['Purchase invoices', 'GSTR-2B (auto-populated)'],
        isRequired: true,
        dueDay: 20,
        paymentStep: true,
      },
      {
        stepNumber: 4,
        title: 'Pay GST Challan (if tax due)',
        titleHindi: 'GST चालान भुगतान करें (यदि कर देय है)',
        description: 'Create and pay GST challan through net banking or UPI. Save challan as proof.',
        descriptionHindi: 'नेट बैंकिंग या UPI के माध्यम से GST चालान बनाएं और भुगतान करें। चालान को सबूत के रूप में सहेजें।',
        officialUrl: OFFICIAL_LINKS.gst_challan,
        documents: [],
        isRequired: false,
        conditional: 'Only if tax is payable',
      },
    ],
    legalNote: {
      text: 'Late fee: ₹50/day (₹25 CGST + ₹25 SGST) for normal returns, capped by turnover bracket. 18% p.a. interest on unpaid tax.',
      source: 'S.47 + S.50 CGST Act',
      sourceUrl: 'https://calcguru.in/gst-late-fee-interest-fy-2026-27-guide',
      lastVerified: '2026-09-30',
    },
    estimatedTime: '30–60 minutes',
    disclaimer: 'This is a general guide. Verify your specific filing period and amounts on the GST portal.',
  },

  udyam_registration: {
    title: 'Udyam Registration',
    titleHindi: 'उद्यम पंजीकरण',
    steps: [
      {
        stepNumber: 1,
        title: 'Visit Udyam Registration Portal',
        titleHindi: 'उद्यम पंजीकरण पोर्टल पर जाएं',
        description: 'Go to udyamregistration.gov.in — completely free, no intermediary needed.',
        descriptionHindi: 'udyamregistration.gov.in पर जाएं — पूरी तरह से नि:शुल्क, किसी बिचौलिए की जरूरत नहीं।',
        officialUrl: OFFICIAL_LINKS.udyam_registration,
        documents: [],
        isRequired: true,
      },
      {
        stepNumber: 2,
        title: 'Enter Aadhaar Number',
        titleHindi: 'आधार नंबर दर्ज करें',
        description: 'Use your Aadhaar-linked mobile for OTP verification. For enterprises, use proprietor/partner/director Aadhaar.',
        descriptionHindi: 'OTP सत्यापन के लिए अपने आधार से जुड़े मोबाइल का उपयोग करें।',
        officialUrl: OFFICIAL_LINKS.udyam_registration,
        documents: ['Aadhaar card', 'Aadhaar-linked mobile phone'],
        isRequired: true,
      },
      {
        stepNumber: 3,
        title: 'Enter PAN and Business Details',
        titleHindi: 'PAN और व्यवसाय विवरण दर्ज करें',
        description: 'Enter PAN, GSTIN (if available), business name, type, bank details, and NIC code.',
        descriptionHindi: 'PAN, GSTIN (यदि उपलब्ध हो), व्यवसाय का नाम, प्रकार, बैंक विवरण और NIC कोड दर्ज करें।',
        officialUrl: OFFICIAL_LINKS.udyam_registration,
        documents: ['PAN card', 'Bank account details', 'Business address proof'],
        isRequired: true,
      },
      {
        stepNumber: 4,
        title: 'Submit and Download Certificate',
        titleHindi: 'सबमिट करें और प्रमाणपत्र डाउनलोड करें',
        description: 'Submit the form. Udyam certificate with your Udyam number will be emailed immediately. Download and save it.',
        descriptionHindi: 'फॉर्म सबमिट करें। उद्यम संख्या के साथ उद्यम प्रमाणपत्र तुरंत ईमेल किया जाएगा। डाउनलोड करके सहेजें।',
        officialUrl: OFFICIAL_LINKS.udyam_registration,
        documents: [],
        isRequired: true,
      },
    ],
    legalNote: {
      text: 'Udyam registration is free, paperless, and self-declared. No documents need to be uploaded — the form auto-fetches from Aadhaar and IT databases.',
      source: 'Ministry of MSME Notification S.O. 2119(E)',
      sourceUrl: 'https://udyamregistration.gov.in',
      lastVerified: '2026-09-15',
    },
    estimatedTime: '15–20 minutes',
    disclaimer: 'Keep your Udyam certificate — it is required for most government schemes and bank loans.',
  },

  cm_yuva_scheme: {
    title: 'CM YUVA Loan Application',
    titleHindi: 'CM YUVA ऋण आवेदन',
    steps: [
      {
        stepNumber: 1,
        title: 'Check Eligibility',
        titleHindi: 'पात्रता जांचें',
        description: 'You must be 21–40 years old, resident of UP, with a valid business plan. Udyam registration recommended.',
        descriptionHindi: 'आपकी आयु 21-40 वर्ष होनी चाहिए, UP का निवासी होना चाहिए, और एक वैध व्यवसाय योजना होनी चाहिए।',
        officialUrl: OFFICIAL_LINKS.up_msme,
        documents: [],
        isRequired: true,
      },
      {
        stepNumber: 2,
        title: 'Visit UP MSME Connect Portal',
        titleHindi: 'UP MSME Connect पोर्टल पर जाएं',
        description: 'Register on msme1connect.up.gov.in and apply for CM YUVA scheme.',
        descriptionHindi: 'msme1connect.up.gov.in पर पंजीकरण करें और CM YUVA योजना के लिए आवेदन करें।',
        officialUrl: OFFICIAL_LINKS.up_msme,
        documents: ['Aadhaar card', 'Age proof', 'UP domicile certificate'],
        isRequired: true,
      },
      {
        stepNumber: 3,
        title: 'Submit Business Plan',
        titleHindi: 'व्यवसाय योजना जमा करें',
        description: 'Prepare and upload a simple business plan (2–3 pages). Include investment details and expected revenue.',
        descriptionHindi: 'एक सरल व्यवसाय योजना (2-3 पृष्ठ) तैयार करें और अपलोड करें।',
        officialUrl: OFFICIAL_LINKS.up_msme,
        documents: ['Business plan', 'Udyam certificate (if available)', 'Bank account details'],
        isRequired: true,
      },
      {
        stepNumber: 4,
        title: 'Bank Verification and Disbursement',
        titleHindi: 'बैंक सत्यापन और वितरण',
        description: 'The partnered bank will verify your application and disburse the interest-free loan up to ₹5 lakh.',
        descriptionHindi: 'सहयोगी बैंक आपके आवेदन की जांच करेगा और ₹5 लाख तक का ब्याज-मुक्त ऋण वितरित करेगा।',
        officialUrl: OFFICIAL_LINKS.up_msme,
        documents: [],
        isRequired: true,
      },
    ],
    legalNote: {
      text: 'CM YUVA scheme: ₹1,000 Cr budget FY 2026-27. Interest-free collateral-free loans up to ₹5 lakh for youth aged 21–40 in UP.',
      source: 'UP MSME Policy 2022 / msme1connect.up.gov.in',
      sourceUrl: 'https://msme1connect.up.gov.in',
      lastVerified: '2026-09-20',
    },
    estimatedTime: '2–4 weeks (application to disbursement)',
    disclaimer: 'Verify current scheme availability and caps on msme1connect.up.gov.in before applying.',
  },
};

// ── Main PATHWAY function ─────────────────────────────────────────────────────

function getPathway(pathwayType, profile = {}) {
  const template = PATHWAY_TEMPLATES[pathwayType];

  if (!template) {
    return {
      error: `No pathway found for type: ${pathwayType}`,
      availableTypes: Object.keys(PATHWAY_TEMPLATES),
    };
  }

  return {
    pathwayType,
    ...template,
    // Add profile-specific context
    profileContext: {
      gstin: profile.gstin,
      udyamNumber: profile.udyamNumber,
      businessName: profile.businessName,
      state: profile.state,
    },
    // Trust layer metadata
    trustLayer: {
      officialLinksOnly: true,
      noLoginRequired: true,
      noAutoFiling: true,
      disclaimer: 'ComplianceOS guides you to the right portal. We never log in or file on your behalf.',
    },
  };
}

function listPathways() {
  return Object.keys(PATHWAY_TEMPLATES).map(key => ({
    type: key,
    title: PATHWAY_TEMPLATES[key].title,
    titleHindi: PATHWAY_TEMPLATES[key].titleHindi,
    estimatedTime: PATHWAY_TEMPLATES[key].estimatedTime,
  }));
}

export { getPathway, listPathways, OFFICIAL_LINKS };
export default { getPathway, listPathways, OFFICIAL_LINKS };
