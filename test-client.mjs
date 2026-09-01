function normalizePhone(value = "") {
  let digits = String(value || "").replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0") && digits.length === 10) digits = "33" + digits.slice(1);
  return digits;
}

export function getTestClientByPhone(phone) {
  const configuredPhone = normalizePhone(process.env.TOM_TEST_CLIENT_PHONE || "");
  const callerPhone = normalizePhone(phone);

  if (!configuredPhone || !callerPhone || configuredPhone !== callerPhone) {
    return null;
  }

  const name = String(process.env.TOM_TEST_CLIENT_NAME || "Client test").trim();
  const firstName = String(
    process.env.TOM_TEST_CLIENT_FIRST_NAME || name.split(/\s+/)[0] || ""
  ).trim();
  const address = String(process.env.TOM_TEST_CLIENT_ADDRESS || "").trim() || null;

  return {
    known: true,
    name,
    firstName,
    address,
  };
}
