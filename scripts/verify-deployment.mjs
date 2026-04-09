/**
 * verify-deployment.mjs — Standalone Vercel deployment checker.
 *
 * Usage:
 *   VERCEL_TOKEN=xxx VERCEL_PROJECT_ID=yyy node scripts/verify-deployment.mjs
 */

const VERCEL_TOKEN = process.env.VERCEL_TOKEN;
const PROJECT_ID = process.env.VERCEL_PROJECT_ID;

if (!VERCEL_TOKEN || !PROJECT_ID) {
  console.error("Missing VERCEL_TOKEN or VERCEL_PROJECT_ID env vars");
  process.exit(1);
}

async function verifyDeployment() {
  const res = await fetch(
    `https://api.vercel.com/v6/deployments?projectId=${PROJECT_ID}`,
    {
      headers: {
        Authorization: `Bearer ${VERCEL_TOKEN}`,
      },
    },
  );

  if (!res.ok) {
    throw new Error(`Vercel API returned ${res.status}: ${res.statusText}`);
  }

  const data = await res.json();
  const latest = data.deployments?.[0];

  if (!latest) {
    throw new Error("No deployments found");
  }

  const deploymentSha = latest.meta?.githubCommitSha;
  const status = latest.state;

  console.log("Deployment ID:", latest.uid);
  console.log("Commit SHA:", deploymentSha);
  console.log("Status:", status);

  if (status !== "READY") {
    throw new Error(`Deployment not ready (state: ${status})`);
  }

  if (!deploymentSha) {
    throw new Error("No commit SHA found in deployment metadata");
  }

  console.log("Deployment Verified Successfully");

  return {
    deploymentId: latest.uid,
    commit: deploymentSha,
    status,
  };
}

verifyDeployment().catch((err) => {
  console.error("Verification Failed:", err.message);
  process.exit(1);
});
