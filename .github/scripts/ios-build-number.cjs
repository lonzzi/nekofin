function iosBuildNumber(runNumber) {
  if (!/^[1-9]\d*$/.test(String(runNumber)))
    throw new Error('Expected a positive workflow run number');
  const number = BigInt(runNumber);
  const major = number / 10000n + 1n;
  if (major > 9999n) throw new Error('iOS build number range exhausted');
  return `${major}.${(number / 100n) % 100n}.${number % 100n}`;
}
module.exports = { iosBuildNumber };
if (require.main === module) console.log(`ios_build_number=${iosBuildNumber(process.argv[2])}`);
