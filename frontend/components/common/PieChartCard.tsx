import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { G, Path, Circle, Text as SvgText } from "react-native-svg";

export type PieChartItem = {
  label: string;
  value: number;
  color: string;
};

export type PieChartCardProps = {
  title: string;
  subtitle?: string;
  data: PieChartItem[];
  size?: number;
  donut?: boolean;
};

// Converte um ângulo em graus para uma posição no círculo
function polarToCartesian(
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
) {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;

  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
}

// Gera o caminho SVG usado para desenhar cada fatia do gráfico
function describeArc(
  x: number,
  y: number,
  outerRadius: number,
  innerRadius: number,
  startAngle: number,
  endAngle: number
) {
  // Limita o círculo completo para evitar problemas na renderização do svg
  const sweepAngle = endAngle - startAngle;
  const effectiveEndAngle =
    sweepAngle >= 360 ? startAngle + 359.999 : endAngle;

  const startOuter = polarToCartesian(
    x,
    y,
    outerRadius,
    effectiveEndAngle
  );

  const endOuter = polarToCartesian(
    x,
    y,
    outerRadius,
    startAngle
  );

  const startInner = polarToCartesian(
    x,
    y,
    innerRadius,
    effectiveEndAngle
  );

  const endInner = polarToCartesian(
    x,
    y,
    innerRadius,
    startAngle
  );

  // Define se o arco deve representar mais ou menos de 180 graus
  const largeArcFlag =
    effectiveEndAngle - startAngle <= 180 ? "0" : "1";

  if (innerRadius <= 0) {
    // Cria uma fatia sólida no formato de pizza
    return [
      "M",
      x,
      y,
      "L",
      endOuter.x,
      endOuter.y,
      "A",
      outerRadius,
      outerRadius,
      0,
      largeArcFlag,
      1,
      startOuter.x,
      startOuter.y,
      "Z",
    ].join(" ");
  }

  // Cria uma fatia com espaço no centro, formando o efeito donut
  return [
    "M",
    endOuter.x,
    endOuter.y,
    "A",
    outerRadius,
    outerRadius,
    0,
    largeArcFlag,
    1,
    startOuter.x,
    startOuter.y,
    "L",
    startInner.x,
    startInner.y,
    "A",
    innerRadius,
    innerRadius,
    0,
    largeArcFlag,
    0,
    endInner.x,
    endInner.y,
    "Z",
  ].join(" ");
}

export default function PieChartCard({
  title,
  subtitle,
  data,
  size = 180,
  donut = true,
}: PieChartCardProps) {

  // Calcula o valor total de todos os itens do gráfico
  const total = data.reduce(
    (acc, item) => acc + (item.value || 0),
    0
  );

  const center = size / 2;
  const outerRadius = size / 2 - 8;
  const innerRadius = donut ? outerRadius * 0.62 : 0;

  let currentAngle = 0;

  // Calcula a porcentagem, o ângulo e o caminho de cada fatia
  const slices = data.map((item) => {
    const value = Math.max(0, item.value || 0);
    const percentage = total > 0 ? (value / total) * 100 : 0;
    const angleSpan = total > 0 ? (value / total) * 360 : 0;

    const startAngle = currentAngle;
    const endAngle = currentAngle + angleSpan;

    currentAngle += angleSpan;

    const pathData =
      total > 0 && angleSpan > 0
        ? describeArc(
            center,
            center,
            outerRadius,
            innerRadius,
            startAngle,
            endAngle
          )
        : "";

    return {
      ...item,
      percentage,
      pathData,
    };
  });

  return (
    <View style={styles.cardContainer}>

      {/* Cabeçalho com título e subtítulo do gráfico */}
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>

        {subtitle && (
          <Text style={styles.subtitle}>{subtitle}</Text>
        )}
      </View>

      {/* Área que contém o gráfico e suas legendas */}
      <View style={styles.chartWrapper}>

        <View
          style={{
            width: size,
            height: size,
            alignItems: "center",
            justifyContent: "center",
          }}
        >

          {total === 0 ? (
            // Exibe um círculo vazio quando não existem dados
            <Svg width={size} height={size}>
              <Circle  cx={center}  cy={center}
                r={outerRadius}
                fill="none"
                stroke="#E2E8F0"
                strokeWidth={
                  donut
                    ? outerRadius - innerRadius
                    : outerRadius
                }
              />

              <SvgText x={center} y={center + 4}
                textAnchor="middle"
                fontSize="12"
                fill="#94A3B8"
                fontWeight="500"
              >
                Sem dados
              </SvgText>
            </Svg>
          ) : (
            <Svg width={size} height={size}>

              {/* Renderiza todas as fatias do gráfico */}
              <G>
                {slices.map((slice, idx) =>
                  slice.pathData ? (
                    <Path
                      key={`slice-${idx}`}
                      d={slice.pathData}
                      fill={slice.color}
                    />
                  ) : null
                )}
              </G>

              {donut && (
                // Exibe o valor total no centro do gráfico donut
                <G>
                  <SvgText  x={center} y={center - 4}
                    textAnchor="middle"
                    fontSize="20"
                    fontWeight="bold"
                    fill="#1E293B"
                  >
                    {total}
                  </SvgText>

                  <SvgText x={center} y={center + 14}
                    textAnchor="middle"
                    fontSize="10"
                    fill="#64748B"
                    fontWeight="600"
                  >
                    TOTAL
                  </SvgText>
                </G>
              )}
            </Svg>
          )}
        </View>

        {/* Exibe as legendas, valores e porcentagens de cada categoria */}
        <View style={styles.legendContainer}>
          {data.map((item, idx) => {
            // Calcula a porcentagem de cada categoria em relação ao total
            const val = item.value || 0;
            const pct =
              total > 0
                ? ((val / total) * 100).toFixed(1)
                : "0.0";

            return (
              <View
                key={`legend-${idx}`}
                style={styles.legendItem}
              >
                <View
                  style={[
                    styles.colorDot,
                    { backgroundColor: item.color },
                  ]}
                />

                <View style={styles.legendTextWrapper}>
                  <Text
                    style={styles.legendLabel}
                    numberOfLines={1}
                  >
                    {item.label}
                  </Text>

                  <Text style={styles.legendValue}>
                    {val} ({pct}%)
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  cardContainer: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 20,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    shadowColor: "#0F2B3D",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },

  header: {
    marginBottom: 12,
  },

  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#285A71",
  },

  subtitle: {
    fontSize: 11,
    color: "#64748B",
    marginTop: 2,
  },

  chartWrapper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    flexWrap: "wrap",
    gap: 16,
  },

  legendContainer: {
    flex: 1,
    minWidth: 130,
    justifyContent: "center",
    gap: 10,
  },

  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  colorDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },

  legendTextWrapper: {
    flex: 1,
  },

  legendLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#334155",
  },

  legendValue: {
    fontSize: 11,
    color: "#64748B",
    fontWeight: "500",
  },
});