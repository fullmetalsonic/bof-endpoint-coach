# Security and operational data

## 한국어

- 실제 회사 차지 이력, 사내 강종 기준, 설비 식별자, 작업자 정보, 기밀 계수는 공개 이슈·PR·커밋에 올리지 마십시오.
- 공개 저장소의 DEMO 값은 합성 데이터이며 현장 적용 승인을 뜻하지 않습니다.
- v0.6 단일 JSON 복원은 50 MiB 제한, 위험 키·중첩 깊이, 스키마·SHA-256·건수·참조·시간·수치 정합성을 검사하고 전체 교체 전 보호 복구점을 만듭니다. CSV ZIP은 구형 호환 경로입니다.
- 이러한 검사는 파일 훼손과 구조 오류를 찾는 장치일 뿐, 실제 공정 타당성이나 회사 승인 여부까지 보증하지 않습니다.
- JSON·CSV·XLSX는 암호화 파일이 아닙니다. 실제 조업자료는 회사가 승인한 PC·폴더·전송수단에서만 보관하십시오.
- v0.6.1 비상복구 카드와 복구문자열도 실제 현장 보정계수를 드러낼 수 있습니다. 스크린샷·사진·출력물·수기 메모를 공개 저장소, 개인 메일, 개인 클라우드에 올리지 말고 회사의 보관·폐기 기준을 적용하십시오.
- 카드의 기준지문 12자리와 확인코드 8자리는 수기 오탈자·카드 혼합 탐지용 축약값입니다. 암호화, 사용자 인증, 전자서명 또는 악의적 변조 방지 수단이 아닙니다.
- 보안 취약점은 공개 이슈에 실제 데이터를 붙이지 말고 저장소 소유자에게 비공개로 알려 주십시오.

## English

- Do not attach real plant heats, internal grade limits, equipment identifiers, operator information, or confidential coefficients to public issues, pull requests, or commits.
- DEMO values are synthetic and do not imply plant approval.
- The v0.6 JSON restore path enforces a 50 MiB limit, rejects dangerous keys and excessive nesting, verifies schema, SHA-256, counts, references, times, and values, and creates a protected recovery point before replacement. CSV ZIP remains a legacy compatibility path.
- These checks detect file corruption and structural errors; they do not establish plant-process validity or company authorization.
- JSON, CSV, and XLSX files are not encrypted. Keep real operational data only on company-approved PCs, folders, and transfer channels.
- v0.6.1 recovery-card screenshots, printouts, handwritten notes, and recovery strings may also expose confidential site coefficients. Keep and dispose of them under approved company policy; never place them in public repositories or personal channels.
- The 12-character base fingerprint and 8-character check code are shortened transcription-error checks, not encryption, authentication, a digital signature, or protection against a malicious editor.
- Report vulnerabilities privately to the repository owner without including operational data in a public issue.
