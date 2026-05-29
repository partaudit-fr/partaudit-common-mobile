// Generic deviation-report-style screen. Wraps the DynamicForm with a
// tinted hero header (icon + title + subtitle + progress) and per-section
// status counters. Used by both mobile-client and mobile-pro for
// changements-principaux / plan-audit / similar form-driven flows — the
// only thing that varies is template_code + hero color + userRole.
//
// Endpoint:
//   GET /v2/deviation-reports/reservations/{reservation_id}/instances?template_code={template_code}
//
// PDF preview/share are wired through the shared usePdfDownload hook —
// the consumer passes onPreviewUri so the host app routes to its own
// pdf-viewer screen.

import React, { type ComponentType } from 'react';
import {
  View, Text, Pressable, ScrollView, StyleSheet, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { ChevronLeft, Eye, Download, FileText } from 'lucide-react-native';
import type { ApiClient } from '../api/createApiClient';
import { useAuth } from '../providers/AuthProvider';
import { usePdfDownload } from '../hooks/usePdfDownload';
import DynamicForm from './DynamicForm';

interface FormSection {
  id: string;
  status: string;
}

interface FormInstance {
  id: string;
  // Required to match DynamicForm's FormInstance contract — the backend
  // always returns a status string, so no need to widen to optional.
  status: string;
  sections?: FormSection[];
  template?: any;
}

interface FormInstancesResponse {
  instances?: FormInstance[];
  template?: any;
  context?: any;
  reference_data?: any;
  referenceData?: any;
}

export interface DeviationReportScreenProps {
  api: ApiClient;
  reservation_id: string;
  template_code: string;
  /** 'client' or 'evaluator' — the DynamicForm uses this for section permissions. */
  userRole?: string;
  /** Hero title (already translated). */
  title: string;
  /** Hero subtitle (already translated). */
  subtitle?: string;
  /** Hex color for the hero background. */
  heroColor: string;
  /** Icon component (lucide-react-native style). */
  HeroIcon?: ComponentType<{ size?: number; color?: string }>;
  onBack: () => void;
  /** Per-app PDF viewer routing. If omitted, the share sheet handles it. */
  onPreviewPdf?: (uri: string, title: string) => void;
  readOnly?: boolean;
}

export default function DeviationReportScreen({
  api, reservation_id, template_code, userRole = 'evaluator',
  title, subtitle, heroColor, HeroIcon = FileText,
  onBack, onPreviewPdf, readOnly = false,
}: DeviationReportScreenProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { getAccessToken } = useAuth();
  const pdf = usePdfDownload({ getAccessToken, onPreviewUri: onPreviewPdf });

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['deviation-instances', reservation_id, template_code],
    queryFn: async () => {
      try {
        return await api.get<FormInstancesResponse>(
          `/v2/deviation-reports/reservations/${reservation_id}/instances?template_code=${template_code}`,
        );
      } catch (err: any) {
        if (err?.status === 404) return null;
        throw err;
      }
    },
    enabled: !!reservation_id,
    refetchOnMount: 'always',
  });

  const instances = data?.instances || [];
  const instance = instances[0] || null;
  const template = data?.template || instance?.template;
  const context = data?.context;
  const referenceData = data?.reference_data;
  const sections = instance?.sections || [];

  const validated = sections.filter((sec) => sec.status === 'validated').length;
  const submitted = sections.filter((sec) => sec.status === 'submitted').length;
  const draft = sections.length - validated - submitted;
  const pct = sections.length > 0 ? Math.round((validated / sections.length) * 100) : 0;

  const pdf_url = instance
    ? `${getApiBaseUrl(api)}/v2/deviation-reports/instances/${instance.id}/download/pdf`
    : '';

  return (
    <View style={s.root}>
      {/* Tinted hero header — extends to top edge under the status bar. */}
      <View style={[s.hero, { backgroundColor: heroColor, paddingTop: insets.top + 8 }]}>
        <View style={s.heroNav}>
          <Pressable onPress={onBack} hitSlop={12}>
            <ChevronLeft size={24} color="#FFF" />
          </Pressable>
          {instance && (
            <View style={s.heroActions}>
              {pdf.downloading && <ActivityIndicator size="small" color="#FFF" />}
              <Pressable
                style={s.iconBtn}
                onPress={() => pdf.preview(pdf_url, title)}
                disabled={pdf.downloading}
                hitSlop={8}
              >
                <Eye size={20} color={pdf.downloading ? 'rgba(255,255,255,0.4)' : '#FFF'} />
              </Pressable>
              <Pressable
                style={s.iconBtn}
                onPress={() => pdf.share(pdf_url)}
                disabled={pdf.downloading}
                hitSlop={8}
              >
                <Download size={20} color={pdf.downloading ? 'rgba(255,255,255,0.4)' : '#FFF'} />
              </Pressable>
            </View>
          )}
        </View>

        <View style={s.heroContent}>
          <View style={s.heroIconBox}>
            <HeroIcon size={22} color={heroColor} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.heroTitle}>{title}</Text>
            {!!subtitle && <Text style={s.heroSubtitle}>{subtitle}</Text>}
          </View>
        </View>

        {instance && sections.length > 0 && (
          <View style={s.progressSection}>
            <View style={s.progressLabelRow}>
              <Text style={s.progressLabel}>{t('common.progress')}</Text>
              <Text style={s.progressValue}>{validated}/{sections.length} ({pct}%)</Text>
            </View>
            <View style={s.progressBar}>
              <View style={[s.progressFill, { width: `${pct}%` }]} />
            </View>
            <View style={s.counters}>
              <Counter dotColor="#FFF" label={`${t('common.validated')}: ${validated}`} />
              <Counter dotColor="rgba(255,255,255,0.5)" label={`${t('common.submitted')}: ${submitted}`} />
              <Counter dotColor="rgba(255,255,255,0.3)" label={`${t('common.draft')}: ${draft}`} />
            </View>
          </View>
        )}
      </View>

      {isLoading ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={heroColor} />
        </View>
      ) : !instance ? (
        <View style={s.center}>
          <FileText size={40} color="#D1D5DB" />
          <Text style={s.emptyText}>{t('deviationReport.notAvailable')}</Text>
        </View>
      ) : !template ? (
        <View style={s.center}>
          <Text style={s.emptyText}>{t('deviationReport.noTemplate')}</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={s.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <DynamicForm
            api={api}
            instance={instance as any}
            template={template}
            context={context}
            userRole={userRole}
            referenceData={referenceData}
            onRefresh={() => refetch()}
            readOnly={readOnly}
          />
          <View style={{ height: 40 }} />
        </ScrollView>
      )}
    </View>
  );
}

function Counter({ dotColor, label }: { dotColor: string; label: string }) {
  return (
    <View style={s.counter}>
      <View style={[s.counterDot, { backgroundColor: dotColor }]} />
      <Text style={s.counterText}>{label}</Text>
    </View>
  );
}

// The ApiClient holds its base URL internally — we don't expose it, so we
// fall back to the env var the consuming app sets. mobile-pro and
// mobile-client both use EXPO_PUBLIC_API_URL.
function getApiBaseUrl(_api: ApiClient): string {
  return (
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_URL) ||
    'https://api.devpartaudit.xyz/app/partaudit'
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F3F4F6' },
  hero: { paddingHorizontal: 16, paddingBottom: 20 },
  heroNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  heroActions: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBtn: { padding: 4 },
  heroContent: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  heroIconBox: {
    width: 48, height: 48, borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  heroTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  heroSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },

  progressSection: {
    marginTop: 16, backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 12, padding: 14,
  },
  progressLabelRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  progressLabel: { fontSize: 13, fontWeight: '500', color: 'rgba(255,255,255,0.8)' },
  progressValue: { fontSize: 13, fontWeight: '700', color: '#FFF' },
  progressBar: {
    height: 8, backgroundColor: 'rgba(255,255,255,0.25)',
    borderRadius: 4, overflow: 'hidden',
  },
  progressFill: { height: 8, backgroundColor: '#FFF', borderRadius: 4 },

  counters: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  counter: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  counterDot: { width: 8, height: 8, borderRadius: 4 },
  counterText: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 },
  emptyText: { fontSize: 16, fontWeight: '600', color: '#9CA3AF', textAlign: 'center' },
  scroll: { padding: 16, gap: 12 },
});
