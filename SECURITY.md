# Security and operational data

## 한국어

- 실제 회사 차지 이력, 사내 강종 기준, 설비 식별자, 작업자 정보, 기밀 계수는 공개 이슈·PR·커밋에 올리지 마십시오.
- 공개 저장소의 DEMO 값은 합성 데이터이며 현장 적용 승인을 뜻하지 않습니다.
- v0.6 단일 JSON 복원은 50 MiB 제한, 위험 키·중첩 깊이, 스키마·SHA-256·건수·참조·시간·수치 정합성을 검사하고 전체 교체 전 보호 복구점을 만듭니다. CSV ZIP은 구형 호환 경로입니다.
- 이러한 검사는 파일 훼손과 구조 오류를 찾는 장치일 뿐, 실제 공정 타당성이나 회사 승인 여부까지 보증하지 않습니다.
- JSON·CSV·XLSX는 암호화 파일이 아닙니다. 실제 조업자료는 회사가 승인한 PC·폴더·전송수단에서만 보관하십시오.
- 보안 취약점은 공개 이슈에 실제 데이터를 붙이지 말고 저장소 소유자에게 비공개로 알려 주십시오.

## English

- Do not attach real plant heats, internal grade limits, equipment identifiers, operator information, or confidential coefficients to public issues, pull requests, or commits.
- DEMO values are synthetic and do not imply plant approval.
- The v0.6 JSON restore path enforces a 50 MiB limit, rejects dangerous keys and excessive nesting, verifies schema, SHA-256, counts, references, times, and values, and creates a protected recovery point before replacement. CSV ZIP remains a legacy compatibility path.
- These checks detect file corruption and structural errors; they do not establish plant-process validity or company authorization.
- JSON, CSV, and XLSX files are not encrypted. Keep real operational data only on company-approved PCs, folders, and transfer channels.
- Report vulnerabilities privately to the repository owner without including operational data in a public issue.
