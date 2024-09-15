export const NextReceiptNumber = async (lastNumber) => {
  // Regular expression to match a complex prefix and numeric part
  // The prefix can include letters and digits but stops at the first numeric sequence
  const match = lastNumber.match(/^([A-Za-z0-9]*-?)(\d+)$/);
  
  if (!match) {
    throw new Error("Invalid receipt number format");
  }

  const prefix = match[1]; // e.g., "KA-", "2A-", or ""
  const numericPart = match[2]; // e.g., "0001" or "00009"

  // Increment the numeric part
  const incrementedNumber = (parseInt(numericPart, 10) + 1).toString();

  // Ensure the incremented number retains the original number of digits
  const nextNumber = incrementedNumber.padStart(numericPart.length, "0");

  // Combine the prefix and the next number
  return `${prefix}${nextNumber}`;
};
