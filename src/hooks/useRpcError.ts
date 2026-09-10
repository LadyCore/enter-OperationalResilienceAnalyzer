import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { RpcResult } from "@/lib/access/types";

/**
 * Translates the backend access mutation error (describeRpcError equivalent)
 * into the active UI language. Returns a localized message for a failed RPC.
 */
export function useRpcError() {
  const { t } = useTranslation();
  return useCallback(
    (result: RpcResult): string => {
      switch (result.reason) {
        case "not_eligible":
          return result.eligible_after
            ? t("access.error.notEligibleUntil", {
                date: new Date(result.eligible_after).toLocaleDateString(),
              })
            : t("access.error.notEligibleYet");
        case "demo_already_active":
          return t("access.error.demoAlreadyActive");
        case "dni_taken":
          return t("access.error.dniTaken");
        case "email_taken":
          return t("access.error.emailTaken");
        case "already_licensed":
          return t("access.error.alreadyLicensed");
        case "owner":
          return t("access.error.owner");
        case "user_not_found":
          return t("access.error.userNotFound");
        case "subscription_disabled":
          return t("access.error.subscriptionDisabled");
        case "forbidden":
          return t("access.error.forbidden");
        case "unauthorized":
          return t("access.error.unauthorized");
        case "seat_exceeded":
          return t("access.error.seatExceeded");
        case "license_not_found":
          return t("access.error.licenseNotFound");
        case "license_not_active":
          return t("access.error.licenseNotActive");
        case "not_perpetual":
          return t("access.error.notPerpetual");
        case "already_added":
          return t("access.error.alreadyAdded");
        case "invalid_license_type":
          return t("access.error.invalidLicenseType");
        default:
          return t("access.error.generic");
      }
    },
    [t]
  );
}
