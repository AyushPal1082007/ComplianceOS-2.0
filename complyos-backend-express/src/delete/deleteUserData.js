import prisma from '../db.js';
import * as alertRepo from '../repos/alertRepo.js';
import * as conversationRepo from '../repos/conversationRepo.js';
import * as deadlineRepo from '../repos/deadlineRepo.js';
import * as documentRepo from '../repos/documentRepo.js';
import * as inboundEventRepo from '../repos/inboundEventRepo.js';
import * as profileRepo from '../repos/profileRepo.js';
import * as traceRepo from '../repos/traceRepo.js';
import * as userRepo from '../repos/userRepo.js';
import { memoryStore, usesMemoryRepository } from '../repos/memory/store.js';
import cloudinaryService from '../services/cloudinaryService.js';

export async function deleteUserData(userId, { cloudinary = cloudinaryService } = {}) {
  if (!userId) throw new TypeError('A user id is required for deletion');

  if (usesMemoryRepository()) {
    const userDocuments = [...memoryStore.documents.values()].filter((document) => document.userId === userId);
    const businessId = memoryStore.profiles.get(userId)?.id || userId;
    for (const document of userDocuments) {
      if (document.cloudinaryId) await cloudinary.deleteFile(document.cloudinaryId);
    }

    for (const [key, match] of memoryStore.schemeMatches) {
      if (match.businessId === businessId || match.userId === userId) memoryStore.schemeMatches.delete(key);
    }
    const removed = {
      profile: await profileRepo.removeForUser(userId),
      conversation: await conversationRepo.remove(userId),
      documents: await documentRepo.removeForUser(userId),
      deadlines: await deadlineRepo.removeForUser(userId),
      alerts: await alertRepo.removeForUser(userId),
      inboundEvents: await inboundEventRepo.removeForUser(userId),
      traces: await traceRepo.removeForUser(userId),
    };
    for (const [key, notification] of memoryStore.notifications) {
      if (notification.userId === userId) memoryStore.notifications.delete(key);
    }
    for (const [key, session] of memoryStore.ariaSessions) {
      if (session.userId === userId) memoryStore.ariaSessions.delete(key);
    }
    const user = await userRepo.anonymizeUser(userId);
    return { removed, retained: { consentLogs: true, subscriptions: true, payments: true }, user };
  }

  const documents = await prisma.document.findMany({
    where: { userId },
    select: { cloudinaryId: true },
  });
  for (const document of documents) {
    if (document.cloudinaryId) await cloudinary.deleteFile(document.cloudinaryId);
  }

  const removed = await prisma.$transaction(async (tx) => {
    const businesses = await tx.businessProfile.findMany({
      where: { userId },
      select: { id: true },
    });
    const businessIds = businesses.map(({ id }) => id);

    const schemeMatches = businessIds.length
      ? await tx.schemeMatch.deleteMany({ where: { businessId: { in: businessIds } } })
      : { count: 0 };
    const profileFields = await tx.profileField.deleteMany({ where: { userId } });
    const conversations = await tx.conversationState.deleteMany({ where: { userId } });
    const deadlines = await tx.complianceDeadline.deleteMany({ where: { userId } });
    const documentRows = await tx.document.deleteMany({ where: { userId } });
    const businessProfiles = await tx.businessProfile.deleteMany({ where: { userId } });
    const sentinelAlerts = await tx.sentinelAlert.deleteMany({ where: { userId } });
    const regulationAlerts = await tx.regulationAlert.deleteMany({ where: { userId } });
    const notifications = await tx.notification.deleteMany({ where: { userId } });
    const ariaSessions = await tx.aRIASession.deleteMany({ where: { userId } });
    const traces = await tx.agentTraceEvent.deleteMany({ where: { userId } });
    const inboundEvents = await tx.inboundEvent.deleteMany({ where: { userId } });
    const user = await tx.user.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@users.complianceos.invalid`,
        phone: null,
        fullName: 'Deleted user',
        isActive: false,
        consentGiven: false,
      },
    });
    return {
      profileFields: profileFields.count,
      conversations: conversations.count,
      documents: documentRows.count,
      deadlines: deadlines.count,
      businessProfiles: businessProfiles.count,
      schemeMatches: schemeMatches.count,
      sentinelAlerts: sentinelAlerts.count,
      regulationAlerts: regulationAlerts.count,
      notifications: notifications.count,
      ariaSessions: ariaSessions.count,
      traces: traces.count,
      inboundEvents: inboundEvents.count,
      user,
    };
  });

  return { removed, retained: { consentLogs: true, subscriptions: true, payments: true } };
}

export default { deleteUserData };
