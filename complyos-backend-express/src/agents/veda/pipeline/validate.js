/**
 * ComplianceOS — VEDA Pipeline: Validate
 * Pure function: runs deterministic validators on extracted fields.
 */

import { validateGstin } from '../../../trust/validators/gstin.js';
import { validatePan, validatePanGstinMatch } from '../../../trust/validators/pan.js';
import { validateUdyam } from '../../../trust/validators/udyam.js';
import { validateDate, validateDateOrder } from '../../../trust/validators/dates.js';
import { validateAmount } from '../../../trust/validators/amounts.js';
import { validateStateConsistency } from '../../../trust/validators/stateConsistency.js';

export function runValidate(docType, fields) {
  const validatorResults = {};

  const addResult = (key, res) => {
    if (!validatorResults[key]) validatorResults[key] = [];
    validatorResults[key].push(res);
  };

  if (docType === 'GST_CERTIFICATE') {
    if (fields.gstin?.value) {
      addResult('gstin', validateGstin(fields.gstin.value));
    }
    if (fields.dateOfRegistration?.value) {
      addResult('dateOfRegistration', validateDate(fields.dateOfRegistration.value));
    }
    if (fields.gstin?.value && (fields.address?.value || fields.state?.value)) {
      const consistency = validateStateConsistency(
        fields.gstin.value,
        fields.state?.value || fields.address?.value
      );
      addResult('state', consistency);
      if (!consistency.ok) {
        addResult('gstin', consistency);
      }
    }
  } else if (docType === 'UDYAM_CERTIFICATE') {
    if (fields.udyamNumber?.value) {
      addResult('udyamNumber', validateUdyam(fields.udyamNumber.value));
    }
    if (fields.dateOfRegistration?.value) {
      addResult('dateOfRegistration', validateDate(fields.dateOfRegistration.value));
    }
  } else if (docType === 'GST_NOTICE') {
    if (fields.gstin?.value) {
      addResult('gstin', validateGstin(fields.gstin.value));
    }
    if (fields.dateOfNotice?.value) {
      addResult('dateOfNotice', validateDate(fields.dateOfNotice.value));
    }
    if (fields.replyDueDate?.value) {
      addResult('replyDueDate', validateDate(fields.replyDueDate.value));
    }
    if (fields.dateOfNotice?.value && fields.replyDueDate?.value) {
      addResult(
        'replyDueDate',
        validateDateOrder(fields.dateOfNotice.value, fields.replyDueDate.value, 'dateOfNotice', 'replyDueDate')
      );
    }
    if (fields.amountDemanded?.value !== null && fields.amountDemanded?.value !== undefined) {
      addResult('amountDemanded', validateAmount(fields.amountDemanded.value));
    }
  } else if (docType === 'CHALLAN_ACK') {
    if (fields.dateFiled?.value) {
      addResult('dateFiled', validateDate(fields.dateFiled.value));
    }
    if (fields.amountPaid?.value !== null && fields.amountPaid?.value !== undefined) {
      addResult('amountPaid', validateAmount(fields.amountPaid.value));
    }
  } else if (docType === 'LICENCE_INVOICE') {
    if (fields.validFrom?.value) {
      addResult('validFrom', validateDate(fields.validFrom.value));
    }
    if (fields.validTo?.value) {
      addResult('validTo', validateDate(fields.validTo.value));
    }
    if (fields.validFrom?.value && fields.validTo?.value) {
      addResult(
        'validTo',
        validateDateOrder(fields.validFrom.value, fields.validTo.value, 'validFrom', 'validTo')
      );
    }
  }

  return { validatorResults };
}

export default runValidate;
