import React, { useState } from 'react';
import { Modal, View, Text, TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react-native';
import { Button } from '../Button';
import { toISODate, parseLocalDate } from '../../utils/date';
import { colors } from '../../theme/tokens';
import { styles } from './styles';

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
const WEEKDAYS = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];

const firstOfMonth = (dateStr: string) => {
  const d = parseLocalDate(dateStr);
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

const capitalize = (s: string) => `${s[0].toUpperCase()}${s.slice(1)}`;

const monthRange = (y: number, m: number) => [toISODate(new Date(y, m, 1)), toISODate(new Date(y, m + 1, 0))] as const;
const yearRange = (y: number) => [`${y}-01-01`, `${y}-12-31`] as const;

// Setas (38px) e rótulo (~36px) ficam com área de toque >= 44 na vertical.
const NAV_HIT_SLOP = { top: 4, bottom: 4 };

interface Props {
  visible: boolean;
  value: string; // YYYY-MM-DD
  minDate?: string;
  maxDate?: string;
  onConfirm: (date: string) => void;
  onClose: () => void;
}

export const DatePickerModal: React.FC<Props> = ({ visible, value, minDate, maxDate, onConfirm, onClose }) => {
  // Páginas de anos terminam no ano de maxDate (ou no ano de hoje): [end-11 .. end], end = anchor - 12k.
  const anchor = (maxDate ? parseLocalDate(maxDate) : new Date()).getFullYear();

  const [selected, setSelected] = useState(value);
  const [month, setMonth] = useState(() => firstOfMonth(value));
  const [mode, setMode] = useState<'days' | 'months' | 'years'>('days');
  const [yearPageEnd, setYearPageEnd] = useState(anchor);
  const [prevVisible, setPrevVisible] = useState(visible);

  // Reseta durante o render (não em useEffect) pra não pintar a seleção antiga ao reabrir.
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) {
      setSelected(value);
      setMonth(firstOfMonth(value));
      setMode('days');
    }
  }

  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells = [...Array(month.getDay()).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  const today = toISODate(new Date());
  const selectedDate = parseLocalDate(selected);
  const monthName = MONTHS[monthIndex];
  const monthLabel = `${capitalize(monthName)} de ${year}`;

  // Intervalo [first, last] inteiro fora de [minDate, maxDate].
  const isOutside = (first: string, last: string) => (!!maxDate && first > maxDate) || (!!minDate && last < minDate);

  // Prende no mês de maxDate/minDate pra `month` nunca apontar pra fora do intervalo.
  const clampMonth = (d: Date) => {
    const [first, last] = monthRange(d.getFullYear(), d.getMonth());
    if (maxDate && first > maxDate) return firstOfMonth(maxDate);
    if (minDate && last < minDate) return firstOfMonth(minDate);
    return d;
  };

  // Setas: mês a mês (dias), ano a ano (meses), 12 anos por vez (anos).
  const shift = (delta: number) => {
    if (mode === 'years') setYearPageEnd(yearPageEnd + 12 * delta);
    else setMonth(clampMonth(mode === 'months' ? new Date(year + delta, monthIndex, 1) : new Date(year, monthIndex + delta, 1)));
  };

  const toggleMode = () => {
    if (mode === 'days') setMode('months');
    else if (mode === 'months') {
      setYearPageEnd(anchor - 12 * Math.floor((anchor - year) / 12));
      setMode('years');
    } else setMode('days');
  };

  const nav = {
    days: {
      prev: 'Mês anterior',
      next: 'Próximo mês',
      label: monthLabel,
      a11y: `Escolher mês e ano, atual: ${monthLabel}`,
      prevDisabled: isOutside(...monthRange(year, monthIndex - 1)),
      nextDisabled: isOutside(...monthRange(year, monthIndex + 1)),
    },
    months: {
      prev: 'Ano anterior',
      next: 'Próximo ano',
      label: String(year),
      a11y: `Escolher ano, atual: ${year}`,
      prevDisabled: isOutside(...yearRange(year - 1)),
      nextDisabled: isOutside(...yearRange(year + 1)),
    },
    years: {
      prev: 'Anos anteriores',
      next: 'Próximos anos',
      label: `${yearPageEnd - 11} – ${yearPageEnd}`,
      a11y: `Voltar para os dias de ${monthLabel}`,
      prevDisabled: isOutside(yearRange(yearPageEnd - 23)[0], yearRange(yearPageEnd - 12)[1]),
      nextDisabled: yearPageEnd >= anchor,
    },
  }[mode];

  // Meses e anos usam a mesma grade 3x4 de pills.
  const pills = mode === 'months'
    ? MONTHS.map((name, m) => {
        const [first, last] = monthRange(year, m);
        return {
          key: name,
          text: capitalize(name.slice(0, 3)),
          label: `${capitalize(name)} de ${year}`,
          isShown: m === monthIndex,
          isCurrent: first.slice(0, 7) === today.slice(0, 7),
          isDisabled: isOutside(first, last),
          onPress: () => {
            setMonth(new Date(year, m, 1));
            setMode('days');
          },
        };
      })
    : Array.from({ length: 12 }, (_, i) => {
        const y = yearPageEnd - 11 + i;
        return {
          key: String(y),
          text: String(y),
          label: String(y),
          isShown: y === year,
          isCurrent: String(y) === today.slice(0, 4),
          isDisabled: isOutside(...yearRange(y)),
          onPress: () => {
            setMonth(clampMonth(new Date(y, monthIndex, 1)));
            setMode('months');
          },
        };
      });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.year}>{selectedDate.getFullYear()}</Text>
          <Text style={styles.selectedLabel}>
            {`${WEEKDAYS[selectedDate.getDay()].slice(0, 3)}., ${selectedDate.getDate()} de ${MONTHS[selectedDate.getMonth()].slice(0, 3)}.`}
          </Text>

          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={() => shift(-1)}
              disabled={nav.prevDisabled}
              style={[styles.navButton, styles.navPrev, nav.prevDisabled && styles.disabled]}
              hitSlop={NAV_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={nav.prev}
              aria-disabled={nav.prevDisabled}
            >
              <ChevronLeft color={colors.text} size={22} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={toggleMode}
              style={styles.modeToggle}
              hitSlop={NAV_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={nav.a11y}
            >
              <Text style={styles.monthLabel} numberOfLines={1}>{nav.label}</Text>
              {mode === 'years' ? <ChevronUp color={colors.text} size={16} /> : <ChevronDown color={colors.text} size={16} />}
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => shift(1)}
              disabled={nav.nextDisabled}
              style={[styles.navButton, styles.navNext, nav.nextDisabled && styles.disabled]}
              hitSlop={NAV_HIT_SLOP}
              accessibilityRole="button"
              accessibilityLabel={nav.next}
              aria-disabled={nav.nextDisabled}
            >
              <ChevronRight color={colors.text} size={22} />
            </TouchableOpacity>
          </View>

          {mode !== 'days' ? (
            <View style={styles.grid}>
              {pills.map((p) => (
                <View key={p.key} style={styles.monthCell}>
                  <TouchableOpacity
                    onPress={p.onPress}
                    disabled={p.isDisabled}
                    style={[
                      styles.monthPill,
                      p.isCurrent && !p.isShown && styles.dayToday,
                      p.isShown && styles.daySelected,
                      p.isDisabled && styles.disabled,
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={p.label}
                    aria-selected={p.isShown}
                    aria-disabled={p.isDisabled}
                  >
                    <Text style={[styles.dayText, p.isShown && styles.dayTextSelected, p.isDisabled && styles.dayTextDisabled]}>
                      {p.text}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.grid}>
              {WEEKDAYS.map((name) => (
                <View key={name} style={styles.cell}>
                  <Text style={styles.weekday} accessibilityLabel={name}>{name[0]}</Text>
                </View>
              ))}
              {cells.map((day, i) => {
                if (day === null) return <View key={`empty-${i}`} style={styles.cell} />;
                const iso = toISODate(new Date(year, monthIndex, day));
                const isSelected = iso === selected;
                const isDisabled = isOutside(iso, iso);
                return (
                  <View key={iso} style={styles.cell}>
                    <TouchableOpacity
                      onPress={() => setSelected(iso)}
                      disabled={isDisabled}
                      style={[
                        styles.day,
                        iso === today && !isSelected && styles.dayToday,
                        isSelected && styles.daySelected,
                        isDisabled && styles.disabled,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={`Selecionar ${day} de ${monthName} de ${year}`}
                      aria-selected={isSelected}
                      aria-disabled={isDisabled}
                    >
                      <Text style={[styles.dayText, isSelected && styles.dayTextSelected, isDisabled && styles.dayTextDisabled]}>
                        {day}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          <View style={styles.actions}>
            <Button title="Cancelar" outline onPress={onClose} style={styles.actionButton} accessibilityLabel="Cancelar seleção de data" />
            <Button title="Confirmar" onPress={() => onConfirm(selected)} style={styles.actionButton} accessibilityLabel="Confirmar data" />
          </View>
        </View>
      </View>
    </Modal>
  );
};
