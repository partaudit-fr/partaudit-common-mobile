/**
 * DynamicForm — Mobile version of the web's DynamicForm/DynamicSection/DynamicField stack.
 * Renders schema-driven forms for: deviation reports, changements principaux, audit plan.
 *
 * Props:
 *  - instance: FormInstance (sections with data + status)
 *  - template: FormTemplate (schema with section/field definitions, permissions, visibility)
 *  - context: InstanceContext (isEvaluator, permissions, etc.)
 *  - userRole: 'client' | 'evaluator'
 *  - referenceData: Record<string, any> for reference/select fields
 *  - onRefresh: () => void — called after save/submit/validate to reload data
 *  - readOnly?: boolean
 */

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, Pressable, TextInput, ScrollView, Switch, StyleSheet,
  ActivityIndicator, Alert, Platform, KeyboardAvoidingView, Modal,
} from 'react-native';
import RenderHtml from 'react-native-render-html';
import { useWindowDimensions } from 'react-native';
import { RichText, useEditorBridge, useBridgeState, TenTapStartKit, PlaceholderBridge } from '@10play/tentap-editor';
import {
  ChevronDown, ChevronUp, Check, Circle, AlertTriangle, Send,
  CheckCircle, XCircle, Clock, FileText, X,
  Bold, Italic, Underline, Strikethrough, List, ListOrdered, WandSparkles,
  Plus, Search,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import type { ApiClient } from '../api/createApiClient';

// Section endpoints used by DynamicForm. The consuming app (mobile-client
// OR mobile-pro) injects its auth-scoped ApiClient as a prop, so both apps
// share the same form implementation.
function useSectionApi(api: ApiClient) {
  return useMemo(() => ({
    saveSectionDraft: (sectionId: string, body: any) =>
      api.put<any>(`/v2/deviation-reports/sections/${sectionId}`, body),
    submitSection: (sectionId: string, body?: any) =>
      api.post<any>(`/v2/deviation-reports/sections/${sectionId}/submit`, body ?? {}),
    validateSection: (sectionId: string) =>
      api.post<any>(`/v2/deviation-reports/sections/${sectionId}/validate`, {}),
  }), [api]);
}

// ── Types (matching web types.ts) ──

interface FieldSchema {
  code: string;
  type: string;
  label: string;
  description?: string;
  placeholder?: string;
  required: boolean;
  order: number;
  options?: { value: string; label: string }[];
  reference?: { entity: string; display_field: string; value_field: string };
  visibility?: { condition: Record<string, any> };
  rows?: number;
  headingLevel?: string;
  validations?: { min_length?: number; max_length?: number; min?: number; max?: number };
  // Display-only / structural fields used by repeating + media types.
  source?: { entity: string; display_field?: string; value_field?: string };
  subfields?: { fields?: FieldSchema[] };
  item_schema?: { fields?: FieldSchema[] };
  itemSchema?: { fields?: FieldSchema[] };
  addButtonLabel?: string;
}

interface SectionSchema {
  code: string;
  title: string;
  description?: string;
  order: number;
  fields: FieldSchema[];
  permissions: { view: string[]; edit: string[]; validate: string[] };
  availability?: { always?: boolean; condition?: Record<string, any>; created_by?: string; createdBy?: string };
}

interface FormSection {
  id: string;
  section_code?: string;
  sectionCode?: string;
  data: Record<string, any>;
  status: string;
  attachments?: any[];
  rejection_reason?: string;
  rejectionReason?: string;
}

interface FormInstance {
  id: string;
  tab_name?: string;
  tabName?: string;
  status: string;
  sections?: FormSection[];
  template?: any;
}

interface InstanceContext {
  isEvaluator: boolean;
  isFollowup: boolean;
  permissions: string[];
}

// ── Status colors ──

const STATUS_COLORS: Record<string, { dot: string; bg: string; text: string; label: string }> = {
  draft: { dot: '#9CA3AF', bg: '#F3F4F6', text: '#6B7280', label: 'draft' },
  in_progress: { dot: '#2563EB', bg: '#EFF6FF', text: '#2563EB', label: 'in_progress' },
  submitted: { dot: '#2563EB', bg: '#EFF6FF', text: '#2563EB', label: 'submitted' },
  validated: { dot: '#059669', bg: '#ECFDF5', text: '#059669', label: 'validated' },
  rejected: { dot: '#DC2626', bg: '#FEF2F2', text: '#DC2626', label: 'rejected' },
  revision_requested: { dot: '#EA580C', bg: '#FFF7ED', text: '#EA580C', label: 'revision_requested' },
  client_approved: { dot: '#059669', bg: '#ECFDF5', text: '#059669', label: 'client_approved' },
  client_revision_requested: { dot: '#EA580C', bg: '#FFF7ED', text: '#EA580C', label: 'client_revision_requested' },
};

// ── Helpers ──

function getSectionCode(section: FormSection): string {
  return section.sectionCode || section.section_code || '';
}

function evaluateCondition(condition: Record<string, any>, sectionData: Record<string, any>): boolean {
  for (const [key, expected] of Object.entries(condition)) {
    let actual = sectionData[key];
    if (actual === undefined) {
      if (typeof expected === 'boolean') actual = false;
      else if (typeof expected === 'number') actual = 0;
      else if (typeof expected === 'string') actual = '';
    }
    if (typeof expected === 'object' && expected !== null) {
      if ('not_equals' in expected && actual === expected.not_equals) return false;
      if ('equals' in expected && actual !== expected.equals) return false;
      continue;
    }
    if (actual !== expected) return false;
  }
  return true;
}

// ── Rich content display (read-only uses RenderHtml, edit uses TextInput) ──

function RichContentDisplay({ html }: { html: string }) {
  const { width } = useWindowDimensions();
  if (!html || html === '—') return <Text style={fs.empty}>—</Text>;
  // If content has HTML tags, render as HTML
  if (/<[a-z][\s\S]*>/i.test(html)) {
    return (
      <RenderHtml
        contentWidth={width - 80}
        source={{ html }}
        baseStyle={{ fontSize: 15, color: '#111827' }}
        tagsStyles={{ p: { marginVertical: 2 }, strong: { fontWeight: '700' }, em: { fontStyle: 'italic' } }}
      />
    );
  }
  return <Text style={fs.readValue}>{html}</Text>;
}

// ── Rich Editor Field ──
//
// Built on @10play/tentap-editor (Tiptap/ProseMirror in a WebView). The
// toolbar is a hand-rolled row of lucide icons so we control the look
// completely (DEFAULT_TOOLBAR_ITEMS uses PNG sprites that don't blend in).
//
// The trailing AI wand button is rendered only when both flags align:
//   - aiAssist === true   → set on the field via the template_generator
//                            (final_report synthesis fields) or via the
//                            admin Template Builder.
//   - userRole === 'evaluator' → AI assist is auditor-only; clients write
//                            their own actions plan unassisted.
// Tapping is a no-op for now (backend AI endpoint not wired).
function RichEditorField({ value, onChange, placeholder, aiAssist, userRole }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
  aiAssist?: boolean; userRole?: string;
}) {
  const showAI = aiAssist === true && userRole === 'evaluator';
  const editor = useEditorBridge({
    initialContent: value || '',
    autofocus: false,
    avoidIosKeyboard: true,
    bridgeExtensions: [
      ...TenTapStartKit,
      PlaceholderBridge.configureExtension({ placeholder: placeholder || '' }),
    ],
    onChange: async () => {
      const html = await editor.getHTML();
      onChange(html);
    },
  });
  const state = useBridgeState(editor);

  const tools: { Icon: any; active: boolean; onPress: () => void }[] = [
    { Icon: Bold,          active: !!state.isBoldActive,        onPress: () => editor.toggleBold() },
    { Icon: Italic,        active: !!state.isItalicActive,      onPress: () => editor.toggleItalic() },
    { Icon: Underline,     active: !!state.isUnderlineActive,   onPress: () => editor.toggleUnderline() },
    { Icon: Strikethrough, active: !!state.isStrikeActive,      onPress: () => editor.toggleStrike() },
    { Icon: List,          active: !!state.isBulletListActive,  onPress: () => editor.toggleBulletList() },
    { Icon: ListOrdered,   active: !!state.isOrderedListActive, onPress: () => editor.toggleOrderedList() },
  ];

  return (
    <View style={fs.richContainer}>
      <View style={fs.richToolbar}>
        {tools.map((t, i) => (
          <Pressable
            key={i}
            onPress={t.onPress}
            style={[fs.toolBtn, t.active && fs.toolBtnActive]}
            hitSlop={4}
          >
            <t.Icon size={17} color={t.active ? '#25408D' : '#374151'} />
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        {showAI && (
          <Pressable
            style={fs.aiBtn}
            onPress={() => { /* TODO: brancher l'assistant IA */ }}
            hitSlop={4}
          >
            <WandSparkles size={16} color="#FFF" />
          </Pressable>
        )}
      </View>
      <RichText editor={editor} style={fs.richEditor} />
    </View>
  );
}

// ── Reference Picker (single + multi) ──
//
// Used for `reference` and `multi_reference` field types — currently the
// final report's `_documents_consulted` (links to reservation document items)
// and `<radio>_fe` (links to fiches d'écart). Items come pre-loaded via the
// screen's referenceData so the modal is a simple in-memory cockable list
// + search filter, no fetch round-trip.
function ReferencePickerField({ multi, items, value, placeholder, onChange, t }: {
  multi: boolean;
  items: any[];
  value: any;
  placeholder: string;
  onChange: (v: any) => void;
  t: (key: string) => string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const labelOf = useCallback((it: any): string =>
    it?.name || it?.title || it?.label || it?.display_name || String(it?.id || ''),
  []);

  const selectedIds: string[] = useMemo(() => {
    if (multi) return (Array.isArray(value) ? value : []).map(String);
    return value != null && value !== '' ? [String(value)] : [];
  }, [multi, value]);

  const selectedItems = useMemo(
    () => selectedIds.map((id) => items.find((i) => String(i.id) === id)).filter(Boolean),
    [items, selectedIds],
  );

  const filtered = useMemo(() => {
    if (!query.trim()) return items;
    const q = query.toLowerCase();
    return items.filter((it) => labelOf(it).toLowerCase().includes(q));
  }, [items, query, labelOf]);

  const toggle = (id: any) => {
    const strId = String(id);
    if (multi) {
      const next = selectedIds.includes(strId)
        ? selectedIds.filter((x) => x !== strId)
        : [...selectedIds, strId];
      onChange(next);
    } else {
      onChange(selectedIds.includes(strId) ? null : strId);
      setOpen(false);
    }
  };

  const removeChip = (id: string) => {
    if (multi) onChange(selectedIds.filter((x) => x !== id));
    else onChange(null);
  };

  return (
    <View style={fs.refContainer}>
      {/* Selected chips + add button */}
      <View style={fs.refChipsRow}>
        {selectedItems.length === 0 && (
          <Text style={fs.refPlaceholder}>{placeholder}</Text>
        )}
        {selectedItems.map((it: any) => (
          <View key={String(it.id)} style={fs.refChip}>
            <Text style={fs.refChipText} numberOfLines={1}>{labelOf(it)}</Text>
            <Pressable onPress={() => removeChip(String(it.id))} hitSlop={6}>
              <X size={14} color="#6B7280" />
            </Pressable>
          </View>
        ))}
        <Pressable style={fs.refAddBtn} onPress={() => { setQuery(''); setOpen(true); }}>
          <Plus size={14} color="#25408D" />
          <Text style={fs.refAddBtnText}>
            {multi
              ? (selectedIds.length === 0 ? t('common.select') : t('common.add'))
              : (selectedIds.length === 0 ? t('common.select') : t('common.change'))}
          </Text>
        </Pressable>
      </View>

      {/* Picker modal */}
      <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={fs.refModalOverlay}>
            <View style={fs.refModalSheet}>
              <View style={fs.refModalHeader}>
                <Text style={fs.refModalTitle}>{placeholder}</Text>
                <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                  <X size={22} color="#6B7280" />
                </Pressable>
              </View>

              <View style={fs.refSearchBox}>
                <Search size={16} color="#9CA3AF" />
                <TextInput
                  style={fs.refSearchInput}
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('common.search')}
                  placeholderTextColor="#9CA3AF"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
                {query.length > 0 && (
                  <Pressable onPress={() => setQuery('')} hitSlop={6}>
                    <X size={14} color="#9CA3AF" />
                  </Pressable>
                )}
              </View>

              <ScrollView style={fs.refModalList} keyboardShouldPersistTaps="handled">
                {filtered.length === 0 && (
                  <Text style={fs.refEmpty}>{t('common.noResults') || '—'}</Text>
                )}
                {filtered.map((it) => {
                  const strId = String(it.id);
                  const isSel = selectedIds.includes(strId);
                  return (
                    <Pressable
                      key={strId}
                      style={[fs.refRow, isSel && fs.refRowSelected]}
                      onPress={() => toggle(it.id)}
                    >
                      <View style={[fs.refCheckbox, isSel && fs.refCheckboxOn]}>
                        {isSel && <Check size={14} color="#FFF" />}
                      </View>
                      <Text style={[fs.refRowText, isSel && fs.refRowTextSelected]} numberOfLines={2}>
                        {labelOf(it)}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              {multi && (
                <View style={fs.refModalFooter}>
                  <Pressable style={fs.refDoneBtn} onPress={() => setOpen(false)}>
                    <Text style={fs.refDoneBtnText}>
                      {t('common.confirm')} ({selectedIds.length})
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

// ── DynamicField ──

function DynamicField({ field, value, disabled, onChange, sectionData, referenceData, userRole, t }: {
  field: FieldSchema; value: any; disabled: boolean;
  onChange?: (code: string, val: any) => void;
  sectionData: Record<string, any>;
  referenceData?: Record<string, any>;
  userRole?: string;
  t: (key: string) => string;
}) {
  // Visibility condition
  if (field.visibility?.condition && sectionData) {
    if (!evaluateCondition(field.visibility.condition, sectionData)) return null;
  }

  const label = field.label || field.code;
  const type = field.type || 'text';
  const options = field.options || [];

  if (type === 'computed') return null;
  if (type === 'heading') {
    return <Text style={fs.heading}>{label}</Text>;
  }

  return (
    <View style={fs.fieldContainer}>
      <Text style={fs.fieldLabel}>
        {label}{field.required ? <Text style={fs.required}> *</Text> : ''}
      </Text>
      {!!field.description && <Text style={fs.fieldDesc}>{field.description}</Text>}

      {/* Text */}
      {type === 'text' && (
        disabled ? (
          <View style={fs.readBox}><Text style={[fs.readValue, !value && fs.empty]}>{value ? String(value) : '—'}</Text></View>
        ) : (
          <TextInput style={fs.input} value={String(value || '')} onChangeText={(v) => onChange?.(field.code, v)}
            placeholder={field.placeholder || ''} placeholderTextColor="#D1D5DB" />
        )
      )}

      {/* Number */}
      {type === 'number' && (
        disabled ? (
          <View style={fs.readBox}><Text style={[fs.readValue, (value == null || value === '') && fs.empty]}>{value != null ? String(value) : '—'}</Text></View>
        ) : (
          <TextInput style={fs.input} value={String(value || '')} onChangeText={(v) => onChange?.(field.code, v)}
            keyboardType="numeric" placeholder="0" placeholderTextColor="#D1D5DB" />
        )
      )}

      {/* Textarea / Richtext */}
      {(type === 'textarea' || type === 'richtext') && (
        disabled ? (
          <View style={fs.readBox}>
            <RichContentDisplay html={value ? String(value) : '—'} />
          </View>
        ) : (
          <RichEditorField
            value={String(value || '')}
            onChange={(v) => onChange?.(field.code, v)}
            placeholder={field.placeholder || ''}
            aiAssist={(field as any).ai_assist === true}
            userRole={userRole}
          />
        )
      )}

      {/* Boolean */}
      {type === 'boolean' && (
        <View style={fs.boolRow}>
          <Switch value={!!value} onValueChange={(v) => { if (!disabled) onChange?.(field.code, v); }}
            disabled={disabled} trackColor={{ true: '#25408D', false: '#D1D5DB' } as any} thumbColor="#FFF" ios_backgroundColor="#D1D5DB" />
          <Text style={fs.boolText}>{value ? t('common.yes') : t('common.no')}</Text>
        </View>
      )}

      {/* Radio */}
      {type === 'radio' && (
        <View style={fs.radioGroup}>
          {options.map((opt) => {
            const selected = value === opt.value;
            return (
              <Pressable key={opt.value} style={[fs.radioOption, selected && fs.radioOptionSelected]}
                onPress={() => !disabled && onChange?.(field.code, opt.value)}>
                <View style={[fs.radioDot, selected && fs.radioDotSelected]}>
                  {selected && <View style={fs.radioDotInner} />}
                </View>
                <Text style={[fs.radioLabel, selected && fs.radioLabelSelected]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Select */}
      {type === 'select' && (
        disabled ? (
          <View style={fs.readBox}>
            <Text style={[fs.readValue, !value && fs.empty]}>
              {options.find((o) => String(o.value) === String(value))?.label || value || '—'}
            </Text>
          </View>
        ) : (
          <View style={fs.radioGroup}>
            {options.map((opt) => {
              const selected = String(value) === String(opt.value);
              return (
                <Pressable key={opt.value} style={[fs.radioOption, selected && fs.radioOptionSelected]}
                  onPress={() => onChange?.(field.code, opt.value)}>
                  <View style={[fs.radioDot, selected && fs.radioDotSelected]}>
                    {selected && <View style={fs.radioDotInner} />}
                  </View>
                  <Text style={[fs.radioLabel, selected && fs.radioLabelSelected]}>{opt.label}</Text>
                </Pressable>
              );
            })}
          </View>
        )
      )}

      {/* Checkbox (multi-select) */}
      {type === 'checkbox' && (
        <View style={fs.radioGroup}>
          {options.map((opt) => {
            const vals = Array.isArray(value) ? value : [];
            const selected = vals.includes(opt.value);
            return (
              <Pressable key={opt.value} style={[fs.radioOption, selected && fs.radioOptionSelected]}
                onPress={() => {
                  if (disabled) return;
                  const next = selected ? vals.filter((v: string) => v !== opt.value) : [...vals, opt.value];
                  onChange?.(field.code, next);
                }}>
                <View style={[fs.checkBox, selected && fs.checkBoxChecked]}>
                  {selected && <Check size={10} color="#FFF" />}
                </View>
                <Text style={[fs.radioLabel, selected && fs.radioLabelSelected]}>{opt.label}</Text>
              </Pressable>
            );
          })}
        </View>
      )}

      {/* Date */}
      {(type === 'date' || type === 'datetime' || type === 'time') && (
        disabled ? (
          <View style={fs.readBox}>
            <Text style={[fs.readValue, !value && fs.empty]}>
              {value ? new Date(value).toLocaleDateString('fr-FR') : '—'}
            </Text>
          </View>
        ) : (
          <TextInput style={fs.input} value={String(value || '')} onChangeText={(v) => onChange?.(field.code, v)}
            placeholder="YYYY-MM-DD" placeholderTextColor="#D1D5DB" />
        )
      )}

      {/* Reference / Multi-reference */}
      {(type === 'reference' || type === 'multi_reference') && (() => {
        const entity = field.reference?.entity || field.source?.entity || field.code || '';
        // Try multiple entity names (exact, plural, singular)
        const tryEntities = [entity, entity.replace(/s$/, ''), entity + 's'];
        let items: any[] = [];
        for (const ent of tryEntities) {
          const rawRef = referenceData?.[ent];
          if (rawRef) {
            items = Array.isArray(rawRef) ? rawRef : rawRef?.items || rawRef?.data || [];
            if (items.length > 0) break;
          }
        }

        const isMulti = type === 'multi_reference';

        if (disabled) {
          // Read-only display: chips for multi, plain text for single
          const resolveLabel = (id: any): string => {
            if (!id) return '—';
            const strId = String(id);
            const found = items.find((i: any) => String(i.id) === strId);
            if (found) return found.name || found.title || found.label || strId;
            return strId.length > 20 ? strId.substring(0, 8) + '...' : strId;
          };
          const displayVal = isMulti
            ? ((Array.isArray(value) ? value : []) as any[]).map(resolveLabel).join(', ') || '—'
            : resolveLabel(value);
          return (
            <View style={fs.readBox}>
              <Text style={[fs.readValue, !value && fs.empty]}>{displayVal}</Text>
            </View>
          );
        }

        return (
          <ReferencePickerField
            multi={isMulti}
            items={items}
            value={value}
            placeholder={field.placeholder || (isMulti ? t('common.select') : t('common.select'))}
            onChange={(v) => onChange?.(field.code, v)}
            t={t}
          />
        );
      })()}

      {/* Repeater */}
      {type === 'repeater' && (() => {
        // Templates ship subfields under one of three shapes — direct array
        // (final_report), { fields: [...] } object (audit_plan), or camelCase.
        const rawSub: any = field.subfields ?? field.item_schema ?? field.itemSchema;
        const subfields: any[] = Array.isArray(rawSub) ? rawSub : (rawSub?.fields || []);
        const rows: any[] = Array.isArray(value) ? value : [];
        const updateRow = (rowIdx: number, code: string, val: any) => {
          const next = rows.map((r, i) => (i === rowIdx ? { ...r, [code]: val } : r));
          onChange?.(field.code, next);
        };
        const removeRow = (rowIdx: number) => {
          onChange?.(field.code, rows.filter((_, i) => i !== rowIdx));
        };
        return (
          <View style={fs.repeaterContainer}>
            {rows.length === 0 && <Text style={fs.empty}>—</Text>}
            {rows.map((row: any, rowIdx: number) => (
              <View key={row.id || rowIdx} style={fs.repeaterRow}>
                <View style={fs.repeaterRowHeader}>
                  <Text style={fs.repeaterRowNum}>#{rowIdx + 1}</Text>
                  {!disabled && (
                    <Pressable onPress={() => removeRow(rowIdx)} hitSlop={8} style={fs.repeaterRemoveBtn}>
                      <X size={14} color="#9CA3AF" />
                    </Pressable>
                  )}
                </View>
                {subfields.filter((sf: any) => !sf.hidden).map((sf: any) => {
                  const val = row[sf.code];
                  // Files are display-only inside repeaters (upload UI not yet wired).
                  if (sf.type === 'files') {
                    return (
                      <View key={sf.code} style={fs.repeaterField}>
                        <Text style={fs.repeaterFieldLabel}>{sf.label}</Text>
                        {Array.isArray(val) && val.length > 0 ? (
                          val.map((f: any, fi: number) => (
                            <View key={fi} style={fs.repeaterFileRow}>
                              <FileText size={12} color="#6B7280" />
                              <Text style={fs.repeaterFileName} numberOfLines={1}>{f.title || f.name || 'Fichier'}</Text>
                            </View>
                          ))
                        ) : (
                          <Text style={[fs.repeaterFieldValue, fs.empty]}>—</Text>
                        )}
                      </View>
                    );
                  }
                  return (
                    <DynamicField
                      key={sf.code}
                      field={sf}
                      value={val}
                      disabled={disabled}
                      onChange={(code, v) => updateRow(rowIdx, code, v)}
                      sectionData={row}
                      referenceData={referenceData}
                      userRole={userRole}
                      t={t}
                    />
                  );
                })}
              </View>
            ))}
            {!disabled && (
              <Pressable style={fs.repeaterAddBtn} onPress={() => {
                const newItem: any = { id: Date.now() };
                subfields.forEach((sf: any) => { newItem[sf.code] = sf.type === 'number' ? null : ''; });
                onChange?.(field.code, [...rows, newItem]);
              }}>
                <Text style={fs.repeaterAddText}>+ {field.addButtonLabel || 'Ajouter'}</Text>
              </Pressable>
            )}
          </View>
        );
      })()}

      {/* Signature */}
      {type === 'signature' && (
        disabled ? (
          <View style={fs.readBox}>
            <Text style={[fs.readValue, !value && fs.empty]}>{value ? String(value) : '—'}</Text>
          </View>
        ) : (
          <TextInput style={fs.input} value={String(value || '')} onChangeText={(v) => onChange?.(field.code, v)}
            placeholder="Signature" placeholderTextColor="#D1D5DB" autoCapitalize="characters" />
        )
      )}
    </View>
  );
}

// ── DynamicSection ──

function DynamicSectionCard({ api, schema, section, expanded, onToggle, userRole, onRefresh, referenceData, readOnly, t }: {
  api: ApiClient;
  schema: SectionSchema; section: FormSection; expanded: boolean; onToggle: () => void;
  userRole: string; onRefresh: () => void; referenceData?: Record<string, any>;
  readOnly?: boolean; t: (key: string, opts?: any) => string;
}) {
  const status = (section.status || 'draft').toLowerCase();
  const cfg = STATUS_COLORS[status] || STATUS_COLORS.draft;
  const schemaFields = (schema.fields || []).sort((a, b) => (a.order || 0) - (b.order || 0));

  // Permissions
  const canEdit = !readOnly && schema.permissions.edit.includes(userRole) &&
    ['draft', 'in_progress', 'revision_requested'].includes(status);
  const canSubmit = schema.permissions.edit.includes(userRole) &&
    ['draft', 'in_progress', 'revision_requested'].includes(status);
  const canValidate = schema.permissions.validate.includes(userRole) && status === 'submitted';

  const sectionApi = useSectionApi(api);
  const [formData, setFormData] = useState<Record<string, any>>({ ...section.data });
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
  const [submitting, setSubmitting] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save on field change (1s debounce)
  const handleFieldChange = useCallback((code: string, value: any) => {
    setFormData((prev) => {
      const next = { ...prev, [code]: value };
      if (canEdit) {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setSaveStatus('saving');
        debounceRef.current = setTimeout(async () => {
          try {
            await sectionApi.saveSectionDraft(section.id, { data: next });
            setSaveStatus('saved');
            setTimeout(() => setSaveStatus('idle'), 2000);
          } catch {
            setSaveStatus('idle');
          }
        }, 1000);
      }
      return next;
    });
  }, [canEdit, section.id]);

  // Submit
  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Save first, then submit
      await sectionApi.saveSectionDraft(section.id, { data: formData });
      await sectionApi.submitSection(section.id);
      onRefresh();
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message || '');
    } finally {
      setSubmitting(false);
    }
  };

  // Validate
  const handleValidate = async () => {
    try {
      await sectionApi.validateSection(section.id);
      onRefresh();
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message || '');
    }
  };

  const statusLabel = t(`deviationReport.secStatus.${status}`, status);

  return (
    <View style={s.sectionCard}>
      {/* Header */}
      <Pressable style={s.sectionHeader} onPress={onToggle}>
        <View style={s.sectionHeaderLeft}>
          <View style={[s.dot, { backgroundColor: cfg.dot }]} />
          <Text style={s.sectionTitle} numberOfLines={1}>{schema.title}</Text>
        </View>
        <View style={s.sectionHeaderRight}>
          <View style={[s.statusPill, { backgroundColor: cfg.bg }]}>
            <Text style={[s.statusPillText, { color: cfg.text }]}>{statusLabel}</Text>
          </View>
          {expanded ? <ChevronUp size={18} color="#9CA3AF" /> : <ChevronDown size={18} color="#9CA3AF" />}
        </View>
      </Pressable>

      {/* Body */}
      {expanded && (
        <View style={s.sectionBody}>
          {!!schema.description && <Text style={s.sectionDesc}>{schema.description}</Text>}

          {/* Rejection reason */}
          {(status === 'rejected' || status === 'revision_requested') && (section.rejection_reason || section.rejectionReason) && (
            <View style={s.rejectionBox}>
              <AlertTriangle size={14} color="#DC2626" />
              <Text style={s.rejectionText}>{section.rejection_reason || section.rejectionReason}</Text>
            </View>
          )}

          {/* Fields */}
          {schemaFields.map((field) => (
            <DynamicField
              key={field.code}
              field={field}
              value={canEdit ? formData[field.code] : section.data[field.code]}
              disabled={!canEdit}
              onChange={canEdit ? handleFieldChange : undefined}
              sectionData={canEdit ? formData : section.data}
              referenceData={referenceData}
              userRole={userRole}
              t={t}
            />
          ))}

          {/* Save indicator */}
          {saveStatus !== 'idle' && (
            <Text style={[s.saveIndicator, saveStatus === 'saved' && { color: '#059669' }]}>
              {saveStatus === 'saving' ? t('changements.saving') : t('changements.saved')}
            </Text>
          )}

          {/* Actions */}
          <View style={s.sectionActions}>
            {canSubmit && !readOnly && (
              <Pressable style={[s.submitBtn, submitting && { opacity: 0.6 }]}
                onPress={handleSubmit} disabled={submitting}>
                {submitting ? <ActivityIndicator size="small" color="#FFF" /> : <Send size={14} color="#FFF" />}
                <Text style={s.submitBtnText}>{t('changements.submit')}</Text>
              </Pressable>
            )}
            {canValidate && !readOnly && (
              <Pressable style={s.validateBtn} onPress={handleValidate}>
                <CheckCircle size={14} color="#FFF" />
                <Text style={s.validateBtnText}>{t('changements.validated')}</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}
    </View>
  );
}

// ── Main DynamicForm component ──

export default function DynamicForm({ api, instance, template, context, userRole = 'client', referenceData, onRefresh, readOnly = false, defaultExpanded = false }: {
  api: ApiClient;
  instance: FormInstance;
  template: any;
  context?: InstanceContext;
  userRole?: string;
  referenceData?: Record<string, any>;
  onRefresh: () => void;
  readOnly?: boolean;
  defaultExpanded?: boolean;
}) {
  const { t } = useTranslation();
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const activeTemplate = template || instance.template;
  const sections = instance.sections || [];

  // Visible sections (filtered by availability conditions)
  const visibleSections: SectionSchema[] = useMemo(() => {
    if (!activeTemplate?.schema?.sections) return [];
    return activeTemplate.schema.sections
      .filter((ss: SectionSchema) => {
        if (!ss.availability) return true;
        if (ss.availability.always) return true;
        // Workflow-created sections: show only if section exists
        const createdBy = ss.availability.createdBy || ss.availability.created_by;
        if (createdBy === 'workflow') {
          return sections.some((s) => getSectionCode(s) === ss.code);
        }
        // Condition-based visibility
        if (ss.availability.condition && context) {
          for (const [key, expected] of Object.entries(ss.availability.condition)) {
            const parts = key.split('.');
            if (parts[0] === 'reservation') {
              const val = (context as any)[parts[1]];
              if (val !== expected) return false;
            }
          }
        }
        return true;
      })
      .sort((a: SectionSchema, b: SectionSchema) => a.order - b.order);
  }, [activeTemplate, sections, context]);

  // Get section data by code
  const getSectionByCode = (code: string): FormSection | undefined => {
    return sections.find((s) => getSectionCode(s) === code);
  };

  // Progress
  const progress = useMemo(() => {
    const total = visibleSections.length;
    const validated = sections.filter((s) => s.status === 'validated').length;
    const submitted = sections.filter((s) => s.status === 'submitted').length;
    const pct = total > 0 ? Math.round((validated / total) * 100) : 0;
    return { total, validated, submitted, draft: total - validated - submitted, pct };
  }, [sections, visibleSections]);

  const toggleSection = (code: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const expandAll = () => setExpandedSections(new Set(visibleSections.map((s) => s.code)));
  const collapseAll = () => setExpandedSections(new Set());

  // Auto-expand all sections when defaultExpanded is true
  React.useEffect(() => {
    if (defaultExpanded && visibleSections.length > 0 && expandedSections.size === 0) {
      expandAll();
    }
  }, [defaultExpanded, visibleSections.length]);

  return (
    <View style={s.container}>
      {/* Expand/Collapse All */}
      <View style={s.expandRow}>
        <Text style={s.sectionsCount}>{visibleSections.length} sections</Text>
        <View style={s.expandButtons}>
          <Pressable onPress={expandAll}><Text style={s.expandText}>{t('deviationReport.expandAll') || 'Tout ouvrir'}</Text></Pressable>
          <Text style={s.expandSep}>|</Text>
          <Pressable onPress={collapseAll}><Text style={s.expandText}>{t('deviationReport.collapseAll') || 'Tout fermer'}</Text></Pressable>
        </View>
      </View>

      {/* Sections */}
      {visibleSections.map((ss) => {
        const section = getSectionByCode(ss.code);
        if (!section) {
          return (
            <View key={ss.code} style={s.sectionUnavailable}>
              <Text style={s.sectionUnavailableText}>{ss.title}</Text>
              <Text style={s.sectionUnavailableSub}>Section non disponible</Text>
            </View>
          );
        }
        return (
          <DynamicSectionCard
            key={ss.code}
            api={api}
            schema={ss}
            section={section}
            expanded={expandedSections.has(ss.code)}
            onToggle={() => toggleSection(ss.code)}
            userRole={userRole}
            onRefresh={onRefresh}
            referenceData={referenceData}
            readOnly={readOnly}
            t={t}
          />
        );
      })}
    </View>
  );
}

// ── Layout styles ──
const s = StyleSheet.create({
  container: { gap: 12 },

  progressCard: { backgroundColor: '#FFF', borderRadius: 14, padding: 18, borderWidth: 1, borderColor: '#F3F4F6', gap: 8 },
  progressHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  progressTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  progressBarBg: { height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, overflow: 'hidden' },
  progressBarFill: { height: 8, backgroundColor: '#059669', borderRadius: 4 },
  progressPct: { fontSize: 13, fontWeight: '600', color: '#111827', textAlign: 'right' },
  progressCounters: { flexDirection: 'row', gap: 16, flexWrap: 'wrap' },
  counterItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  counterDot: { width: 8, height: 8, borderRadius: 4 },
  counterText: { fontSize: 12, color: '#6B7280' },

  expandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionsCount: { fontSize: 14, fontWeight: '600', color: '#111827' },
  expandButtons: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  expandText: { fontSize: 13, fontWeight: '600', color: '#25408D' },
  expandSep: { fontSize: 13, color: '#D1D5DB' },

  sectionCard: { backgroundColor: '#FFF', borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E5E7EB' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#FAFBFC' },
  sectionHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  sectionHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sectionTitle: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusPillText: { fontSize: 12, fontWeight: '600' },

  sectionBody: { padding: 16, gap: 12 },
  sectionDesc: { fontSize: 13, color: '#6B7280', lineHeight: 19 },

  rejectionBox: { flexDirection: 'row', gap: 8, backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12, alignItems: 'flex-start' },
  rejectionText: { flex: 1, fontSize: 13, color: '#DC2626', lineHeight: 18 },

  saveIndicator: { fontSize: 12, color: '#9CA3AF', textAlign: 'right' },

  sectionActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  submitBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#25408D', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  submitBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },
  validateBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#059669', borderRadius: 10, paddingHorizontal: 16, paddingVertical: 12 },
  validateBtnText: { fontSize: 14, fontWeight: '600', color: '#FFF' },

  sectionUnavailable: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  sectionUnavailableText: { fontSize: 14, fontWeight: '500', color: '#9CA3AF' },
  sectionUnavailableSub: { fontSize: 12, color: '#D1D5DB', marginTop: 2 },
});

// ── Field styles ──
const fs = StyleSheet.create({
  fieldContainer: { gap: 4 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: '#374151' },
  required: { color: '#EF4444' },
  fieldDesc: { fontSize: 11, color: '#9CA3AF', marginBottom: 2 },
  heading: { fontSize: 17, fontWeight: '700', color: '#111827', marginTop: 8 },

  readValue: { fontSize: 15, color: '#111827' },
  readBox: { backgroundColor: '#F3F4F6', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10 },
  empty: { color: '#D1D5DB', fontStyle: 'italic' },

  input: { backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', paddingHorizontal: 12, height: 42, fontSize: 15, color: '#111827' },
  textarea: { backgroundColor: '#FFF', borderRadius: 8, borderWidth: 1, borderColor: '#D1D5DB', padding: 12, fontSize: 15, color: '#111827', minHeight: 96, textAlignVertical: 'top' },

  boolRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  boolText: { fontSize: 15, color: '#111827' },

  radioGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  radioOption: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#FFF' },
  radioOptionSelected: { borderColor: '#25408D', backgroundColor: '#EBF0FF' },
  radioDot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  radioDotSelected: { borderColor: '#25408D' },
  radioDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#25408D' },
  radioLabel: { fontSize: 14, color: '#374151' },
  radioLabelSelected: { color: '#25408D', fontWeight: '500' },

  checkBox: { width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: '#D1D5DB', alignItems: 'center', justifyContent: 'center' },
  checkBoxChecked: { backgroundColor: '#25408D', borderColor: '#25408D' },

  repeaterContainer: { gap: 8 },
  repeaterRow: { backgroundColor: '#F9FAFB', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', gap: 8 },
  repeaterRowHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 },
  repeaterRowNum: { fontSize: 11, fontWeight: '700', color: '#9CA3AF' },
  repeaterRemoveBtn: { padding: 4, borderRadius: 6 },
  repeaterField: { gap: 2 },
  repeaterFieldLabel: { fontSize: 11, fontWeight: '600', color: '#6B7280' },
  repeaterFieldValue: { fontSize: 14, color: '#111827' },
  repeaterFileRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 2 },
  repeaterFileName: { fontSize: 13, color: '#374151', flex: 1 },
  repeaterAddBtn: { alignItems: 'center', paddingVertical: 10, borderRadius: 8, backgroundColor: '#EBF0FF' },
  repeaterAddText: { fontSize: 13, fontWeight: '600', color: '#25408D' },

  richContainer: { borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB', overflow: 'hidden', backgroundColor: '#FFF' },
  richToolbar: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    paddingHorizontal: 6, paddingVertical: 6,
    backgroundColor: '#F9FAFB', borderBottomWidth: 1, borderBottomColor: '#E5E7EB',
  },
  toolBtn: { width: 32, height: 32, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  toolBtnActive: { backgroundColor: '#EBF0FF' },
  aiBtn: {
    width: 32, height: 32, borderRadius: 16,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#7C3AED',
  },
  richEditor: { minHeight: 140 },

  // ── Reference picker ──
  refContainer: { },
  refChipsRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 6,
    padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB',
    backgroundColor: '#FFF', minHeight: 44, alignItems: 'center',
  },
  refPlaceholder: { fontSize: 13, color: '#9CA3AF', marginLeft: 4 },
  refChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: '#EBF0FF', borderWidth: 1, borderColor: '#C7D2FE',
    maxWidth: 220,
  },
  refChipText: { fontSize: 12, fontWeight: '600', color: '#1E3A8A', flexShrink: 1 },
  refAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999,
    backgroundColor: '#FFF', borderWidth: 1, borderColor: '#25408D',
  },
  refAddBtnText: { fontSize: 12, fontWeight: '600', color: '#25408D' },

  refModalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end',
  },
  refModalSheet: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '85%', minHeight: '50%',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 12 },
      android: { elevation: 8 },
    }),
  },
  refModalHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: '#F3F4F6',
  },
  refModalTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: '#111827' },
  refSearchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, marginHorizontal: 16, marginTop: 12,
    backgroundColor: '#F3F4F6', borderRadius: 10,
  },
  refSearchInput: { flex: 1, fontSize: 14, color: '#111827', paddingVertical: 0 },
  refModalList: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 12 },
  refEmpty: { textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: 20 },
  refRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8,
  },
  refRowSelected: { backgroundColor: '#EBF0FF' },
  refCheckbox: {
    width: 20, height: 20, borderRadius: 5,
    borderWidth: 1.5, borderColor: '#D1D5DB',
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  refCheckboxOn: { backgroundColor: '#25408D', borderColor: '#25408D' },
  refRowText: { flex: 1, fontSize: 14, color: '#374151' },
  refRowTextSelected: { fontWeight: '600', color: '#25408D' },
  refModalFooter: {
    padding: 16, borderTopWidth: 1, borderTopColor: '#F3F4F6',
  },
  refDoneBtn: {
    backgroundColor: '#25408D', paddingVertical: 13, borderRadius: 10,
    alignItems: 'center',
  },
  refDoneBtnText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
});
