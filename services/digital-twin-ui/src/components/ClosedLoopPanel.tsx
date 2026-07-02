// VS-24 — closed-loop dry-run preview panel (SPEC-S006-VS21).
// Lists the safe actions from GET /action/catalog and lets the operator
// PREVIEW the exact manifest patch each would produce (POST /action/dry-run).
// Preview only — there is no Apply button this sprint (apply/git/auth deferred).
import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import ScienceRoundedIcon from "@mui/icons-material/ScienceRounded";
import { useTranslation } from "react-i18next";

import SectionHeader from "./SectionHeader";
import { dryRunAction, getActionCatalog } from "../api";
import { monoFamily } from "../theme";
import type { ActionCatalogItem, ActionDryRun, ActionParamSpec } from "../types";

function defaultParams(specs: ActionParamSpec[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const s of specs) {
    if (s.default !== undefined) out[s.name] = s.default;
    else if (s.kind === "int") out[s.name] = s.min ?? 1;
    else if (s.kind === "enum") out[s.name] = s.options?.[0];
  }
  return out;
}

export default function ClosedLoopPanel() {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<ActionCatalogItem[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [params, setParams] = useState<Record<string, Record<string, unknown>>>(
    {},
  );
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, ActionDryRun>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const controller = new AbortController();
    getActionCatalog(controller.signal)
      .then((items) => {
        setCatalog(items);
        const seed: Record<string, Record<string, unknown>> = {};
        for (const it of items) seed[it.action_id] = defaultParams(it.params_spec);
        setParams(seed);
      })
      .catch((e: unknown) => {
        if ((e as { name?: string })?.name !== "AbortError") {
          setLoadError((e as Error).message ?? "unknown");
        }
      });
    return () => controller.abort();
  }, []);

  const setParam = (actionId: string, name: string, value: unknown) =>
    setParams((prev) => ({
      ...prev,
      [actionId]: { ...prev[actionId], [name]: value },
    }));

  const preview = async (item: ActionCatalogItem) => {
    setBusy(item.action_id);
    setErrors((prev) => ({ ...prev, [item.action_id]: "" }));
    try {
      const res = await dryRunAction(item.action_id, params[item.action_id] ?? {});
      setResults((prev) => ({ ...prev, [item.action_id]: res }));
    } catch (e: unknown) {
      setErrors((prev) => ({
        ...prev,
        [item.action_id]: (e as Error).message ?? "unknown",
      }));
    } finally {
      setBusy(null);
    }
  };

  return (
    <Box sx={{ mt: 3 }}>
      <SectionHeader
        category={t("nav.aiOps")}
        title={t("closedLoop.title")}
        subtitle={t("closedLoop.subtitle")}
      />

      {loadError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t("closedLoop.loadError", { message: loadError })}
        </Alert>
      )}

      {!catalog && !loadError && <CircularProgress size={22} />}

      <Stack spacing={2}>
        {(catalog ?? []).map((item) => {
          const res = results[item.action_id];
          const err = errors[item.action_id];
          return (
            <Paper key={item.action_id} sx={{ p: 2.5 }}>
              <Stack
                direction="row"
                spacing={1}
                alignItems="center"
                flexWrap="wrap"
                useFlexGap
              >
                <Chip
                  label={item.action_id}
                  size="small"
                  sx={{ fontFamily: monoFamily }}
                />
                <Typography variant="caption" color="text.secondary">
                  {item.target_resource}
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  {t("closedLoop.inverseLabel")}:{" "}
                  {item.inverse_action_id ?? t("closedLoop.noInverse")}
                </Typography>
              </Stack>

              <Typography variant="body2" sx={{ mt: 1 }}>
                {item.description}
              </Typography>

              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{ mt: 1.5 }}
                flexWrap="wrap"
                useFlexGap
              >
                {item.params_spec.map((spec) => {
                  const val = params[item.action_id]?.[spec.name];
                  if (spec.kind === "enum") {
                    return (
                      <Select
                        key={spec.name}
                        size="small"
                        value={String(val ?? "")}
                        onChange={(e) =>
                          setParam(item.action_id, spec.name, e.target.value)
                        }
                        aria-label={spec.name}
                      >
                        {(spec.options ?? []).map((o) => (
                          <MenuItem key={o} value={o}>
                            {o}
                          </MenuItem>
                        ))}
                      </Select>
                    );
                  }
                  return (
                    <TextField
                      key={spec.name}
                      size="small"
                      type="number"
                      label={spec.name}
                      value={String(val ?? "")}
                      onChange={(e) =>
                        setParam(
                          item.action_id,
                          spec.name,
                          Number(e.target.value),
                        )
                      }
                      slotProps={{
                        htmlInput: { min: spec.min, max: spec.max },
                      }}
                      sx={{ width: 120 }}
                    />
                  );
                })}
                <Button
                  variant="outlined"
                  size="small"
                  startIcon={
                    busy === item.action_id ? (
                      <CircularProgress size={14} color="inherit" />
                    ) : (
                      <ScienceRoundedIcon />
                    )
                  }
                  disabled={busy !== null}
                  onClick={() => preview(item)}
                >
                  {busy === item.action_id
                    ? t("closedLoop.previewing")
                    : t("closedLoop.preview")}
                </Button>
              </Stack>

              {err && (
                <Alert severity="error" sx={{ mt: 1.5 }}>
                  {t("closedLoop.previewError", { message: err })}
                </Alert>
              )}

              {res && (
                <Box sx={{ mt: 1.5 }}>
                  <Typography variant="overline" color="text.secondary">
                    {t("closedLoop.diffLabel")}
                  </Typography>
                  <Box
                    component="pre"
                    data-testid={`dry-run-diff-${item.action_id}`}
                    sx={{
                      m: 0,
                      mt: 0.5,
                      p: 1.5,
                      bgcolor: "action.hover",
                      borderLeft: 3,
                      borderColor: "primary.main",
                      fontFamily: monoFamily,
                      fontSize: "0.75rem",
                      whiteSpace: "pre-wrap",
                      overflowX: "auto",
                    }}
                  >
                    {res.diff}
                  </Box>
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ display: "block", mt: 0.5 }}
                  >
                    {res.note}
                  </Typography>
                </Box>
              )}
            </Paper>
          );
        })}
      </Stack>
    </Box>
  );
}
