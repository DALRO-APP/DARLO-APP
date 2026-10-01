import { router } from "expo-router";
import { useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Conditions } from "../../src/components/Conditions";
import { CourseCard } from "../../src/components/CourseCard";
import { Mascot } from "../../src/components/Mascot";
import { RouteMap } from "../../src/components/RouteMap";
import {
  Button,
  Glow,
  Icon,
  Screen,
  SectionTitle,
  Status,
  T,
  useWide,
} from "../../src/components/ui";
import { PURPOSES } from "../../src/domain/catalog";
import { useRecommendations } from "../../src/services/queries";
import { isDemo } from "../../src/services/repository";
import { usePreferences } from "../../src/state/preferences";
import { colors } from "../../src/theme/tokens";
export default function Home() {
  const wide = useWide();
  const query = useRecommendations();
  const request = usePreferences((s) => s.request);
  const [selectedId, setSelectedId] = useState<string>();
  const courses = query.data?.courses ?? [];
  const selected = courses.find((c) => c.id === selectedId) ?? courses[0];
  return (
    <Screen>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <View>
          <T
            accent
            style={{ fontWeight: "900", fontSize: 31, letterSpacing: -1.8 }}
          >
            DALRO<T style={{ color: colors.lime, fontSize: 32 }}>.</T>
          </T>
          <T muted style={{ fontSize: 10, marginTop: 3, letterSpacing: 0.8 }}>
            오늘도, 더 좋은 길로
          </T>
        </View>
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            backgroundColor: colors.panel,
            borderRadius: 20,
            paddingHorizontal: 12,
            paddingVertical: 8,
          }}
        >
          <View
            style={{
              height: 5,
              width: 5,
              borderRadius: 5,
              backgroundColor: colors.lime,
            }}
          />
          <T muted style={{ fontSize: 10 }}>
            {isDemo ? "용산구 DEMO" : "용산구 PILOT"}
          </T>
        </View>
      </View>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <View style={{ flex: 1 }}>
          <T muted style={{ fontSize: 11, letterSpacing: 2, marginBottom: 12 }}>
            FIND YOUR RUN
          </T>
          <T
            style={{
              fontSize: wide ? 49 : 34,
              fontWeight: "900",
              letterSpacing: -1.8,
              lineHeight: wide ? 60 : 43,
            }}
          >
            오늘은<T accent>{"\n"}어디로 달릴까요?</T>
          </T>
          <T
            muted
            style={{ marginTop: 12, fontSize: wide ? 14 : 12, lineHeight: 21 }}
          >
            당신의 목적에 맞는 길,{wide ? " " : "\n"}달로가 함께 찾아드릴게요.
          </T>
        </View>
        <View style={{ alignItems: "center" }}>
          <Mascot size={wide ? 165 : 103} />
          <T accent style={{ fontSize: 10, marginTop: -5 }}>
            오늘도 좋은 러닝데이!
          </T>
        </View>
      </View>
      <Conditions />
      <View
        style={{
          flexDirection: wide ? "row" : "column",
          gap: 22,
          alignItems: "stretch",
        }}
      >
        <View style={{ flex: wide ? 1.7 : undefined, gap: 14 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <Icon name="navigate-outline" color={colors.lime} size={18} />
            <T style={{ fontSize: 14, fontWeight: "700" }}>내 주변 러닝 코스</T>
            <View style={{ flex: 1 }} />
            <T muted style={{ fontSize: 10 }}>
              출발지로 돌아오는 코스
            </T>
          </View>
          <RouteMap
            courses={courses}
            selectedId={selected?.id}
            onSelect={setSelectedId}
            height={wide ? 395 : 280}
          />
          <Glow
            style={{
              padding: 18,
              flexDirection: "row",
              gap: 13,
              alignItems: "center",
            }}
          >
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: "#334527",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Icon
                name={PURPOSES[request.purpose].icon}
                color={colors.lime}
                size={23}
              />
            </View>
            <View style={{ flex: 1, gap: 5 }}>
              <T style={{ fontWeight: "800", fontSize: 14 }}>
                {PURPOSES[request.purpose].label}, 이렇게 달려봐요
              </T>
              <T muted style={{ fontSize: 11 }}>
                {PURPOSES[request.purpose].description}
              </T>
            </View>
          </Glow>
          <T muted style={{ fontSize: 10, lineHeight: 17 }}>
            시연 경로·환경 수치는 가상 데이터입니다. 실제 도로를 따르는 코스
            추천은 서버·알고리즘 연결 후 제공됩니다.
          </T>
        </View>
        <View style={{ flex: wide ? 1 : undefined }}>
          <SectionTitle
            title="지금, 이 코스 어때요?"
            caption="나의 조건에 맞춘 세 가지 선택"
            action="전체보기"
            onPress={() => router.push("/explore")}
          />
          {query.isPending ? (
            <View
              style={{
                minHeight: 250,
                justifyContent: "center",
                alignItems: "center",
                gap: 16,
              }}
            >
              <ActivityIndicator color={colors.lime} />
              <T muted>나에게 맞는 길을 찾고 있어요</T>
            </View>
          ) : query.isError ? (
            <Status
              title="코스를 불러오지 못했어요"
              message={query.error.message}
              onRetry={() => void query.refetch()}
            />
          ) : courses.length === 0 ? (
            <Status
              title="조건에 맞는 코스가 없어요"
              message="다른 출발지나 목표 거리를 선택해 주세요."
            />
          ) : (
            <View style={{ gap: 12 }}>
              {courses.map((course, i) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  rank={i + 1}
                  selected={course.id === selected?.id}
                  onSelect={() => setSelectedId(course.id)}
                  compact
                />
              ))}
            </View>
          )}
        </View>
      </View>
      {selected && (
        <Button
          label="추천 코스 자세히 보기"
          onPress={() =>
            router.push({
              pathname: "/course/[id]",
              params: { id: selected.id },
            })
          }
          style={{ alignSelf: wide ? "flex-start" : "stretch" }}
        />
      )}
    </Screen>
  );
}
