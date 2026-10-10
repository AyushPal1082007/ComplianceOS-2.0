export async function deliverAlert(alert) {
  return {
    delivered: true,
    alert,
  };
}

export default { deliverAlert };
