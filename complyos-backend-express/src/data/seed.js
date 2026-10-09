'use strict';
/**
 * ComplianceOS — Database Seeder
 * Seeds:
 * 1. Demo MSME Owner (Ramesh Kumar - Leather Footwear Manufacturer, Kanpur, UP)
 * 2. Demo CA Partner (CA Rajesh Aggarwal, ICAI #084219)
 * 3. Verified Schemes from schemes.json into the PostgreSQL `schemes` table
 * 4. Sample Compliance Deadlines (GSTR-3B, GSTR-1, Udyam Annual Update)
 * 5. Sample SENTINEL Regulatory Alert
 */
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const prisma = require('../db');
const schemesData = require('./schemes.json');
const logger = require('../logger');

async function seed() {
  console.log('Seeding ComplianceOS PostgreSQL database...');

  const passwordHash = await bcrypt.hash('Password@123', 10);

  // 1. Create or update Demo MSME Owner
  const msmeUser = await prisma.user.upsert({
    where: { email: 'ramesh@kanpurleather.in' },
    update: {},
    create: {
      id: uuidv4(),
      email: 'ramesh@kanpurleather.in',
      phone: '919876543210',
      passwordHash,
      fullName: 'Ramesh Kumar',
      role: 'owner',
      plan: 'growth',
      language: 'hi',
      consentGiven: true,
      consentAt: new Date(),
    },
  });

  // Business Profile for Ramesh
  await prisma.businessProfile.upsert({
    where: { userId: msmeUser.id },
    update: {},
    create: {
      id: uuidv4(),
      userId: msmeUser.id,
      businessName: 'Kanpur Leather Footwear Crafts',
      gstin: '09AAACH7409R1ZZ',
      pan: 'AAACH7409R',
      udyamNumber: 'UDYAM-UP-28-0045678',
      businessType: 'manufacturer',
      sector: 'Leather & Footwear (ODOP)',
      state: 'Uttar Pradesh',
      district: 'Kanpur Nagar',
      annualTurnover: 42.5, // ₹42.5 Lakhs
      employeeCount: 8,
      isWomenLed: false,
      healthScore: 92,
      penaltyAtRisk: 0,
      profileComplete: true,
    },
  });

  // 2. Create Demo CA Partner
  const caUser = await prisma.user.upsert({
    where: { email: 'ca.rajesh@aggarwaltax.com' },
    update: {},
    create: {
      id: uuidv4(),
      email: 'ca.rajesh@aggarwaltax.com',
      phone: '919811223344',
      passwordHash,
      fullName: 'CA Rajesh Aggarwal',
      role: 'ca',
      plan: 'ca_lite',
      language: 'en',
      consentGiven: true,
      consentAt: new Date(),
    },
  });

  // Map MSME to CA
  await prisma.cAClientMap.upsert({
    where: {
      clientId: msmeUser.id,
    },
    update: {},
    create: {
      id: uuidv4(),
      caId: caUser.id,
      clientId: msmeUser.id,
    },
  });

  // 3. Seed Verified Schemes into database
  for (const s of schemesData) {
    try {
      await prisma.scheme.upsert({
        where: { id: s.id },
        update: {
          name: s.name,
          nameHindi: s.nameHindi,
          description: s.description,
          descriptionHindi: s.descriptionHindi,
          ministry: s.ministry,
          schemeType: s.schemeType,
          maxBenefit: s.maxBenefit,
          eligibilityCriteria: s.eligibilityCriteria || {},
          officialUrl: s.officialUrl,
          checklist: s.checklist || [],
          sourceUrl: s.sourceUrl,
          retrievedOn: new Date(s.retrievedOn || '2026-06-30'),
          checkedBy: s.checkedBy || 'Build with Bharat Team',
        },
        create: {
          id: s.id,
          name: s.name,
          nameHindi: s.nameHindi,
          description: s.description,
          descriptionHindi: s.descriptionHindi,
          ministry: s.ministry,
          schemeType: s.schemeType,
          maxBenefit: s.maxBenefit,
          eligibilityCriteria: s.eligibilityCriteria || {},
          officialUrl: s.officialUrl,
          checklist: s.checklist || [],
          sourceUrl: s.sourceUrl,
          retrievedOn: new Date(s.retrievedOn || '2026-06-30'),
          checkedBy: s.checkedBy || 'Build with Bharat Team',
        },
      });
    } catch (schemeErr) {
      // Ignore duplicates
    }
  }

  // 4. Seed Sample Deadlines for Ramesh
  const upcomingDate1 = new Date();
  upcomingDate1.setDate(upcomingDate1.getDate() + 5);

  const upcomingDate2 = new Date();
  upcomingDate2.setDate(upcomingDate2.getDate() + 12);

  await prisma.complianceDeadline.createMany({
    data: [
      {
        id: uuidv4(),
        userId: msmeUser.id,
        title: 'GSTR-3B Monthly Return Filing',
        description: 'Monthly summary return for outward and inward supplies',
        deadlineDate: upcomingDate1,
        complianceType: 'gst_return',
        urgency: 'high',
        status: 'pending',
        sourceUrl: 'https://www.gst.gov.in',
        createdByAgent: 'ARIA',
        penaltyEstimate: 500,
      },
      {
        id: uuidv4(),
        userId: msmeUser.id,
        title: 'GSTR-1 Outward Supplies Statement',
        description: 'Monthly statement of outward supplies and invoices',
        deadlineDate: upcomingDate2,
        complianceType: 'gst_return',
        urgency: 'medium',
        status: 'pending',
        sourceUrl: 'https://www.gst.gov.in',
        createdByAgent: 'ARIA',
        penaltyEstimate: 500,
      },
    ],
    skipDuplicates: true,
  });

  // 5. Seed Sample SENTINEL Regulatory Alert
  await prisma.sentinelAlert.create({
    data: {
      id: uuidv4(),
      userId: msmeUser.id,
      title: 'E-Invoicing Threshold Notification Update',
      titleHindi: 'ई-इनवॉइसिंग सीमा नियम अद्यतन',
      summary: 'Advisory on B2B e-invoicing thresholds. Businesses above specified turnover must generate IRN.',
      summaryHindi: 'B2B बिक्री के लिए ई-इनवॉइसिंग पोर्टल पर IRN जनरेशन नियमों की अधिसूचना।',
      sourceUrl: 'https://einvoice1.gst.gov.in',
      lastVerifiedAt: new Date(),
      isSimulated: true,
      status: 'unread',
    },
  });

  console.log('✅ Database seeded successfully!');
  console.log('MSME Login: ramesh@kanpurleather.in / Password@123');
  console.log('CA Login: ca.rajesh@aggarwaltax.com / Password@123');
}

seed()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
