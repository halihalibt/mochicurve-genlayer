// Stable Studionet may include validator entries inside leader_receipt.
// Consensus agreement and successful leader execution are separate requirements.
export function finalizedExecutionSucceeded(tx) {
  if (tx?.statusName !== 'FINALIZED' || tx.result_name !== 'MAJORITY_AGREE') return false;
  const raw = tx.consensus_data?.leader_receipt;
  const receipts = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const leaders = receipts.filter(receipt => receipt.mode === 'leader');
  return leaders.length === 1 && leaders[0].execution_result === 'SUCCESS';
}
