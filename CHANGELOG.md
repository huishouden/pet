# Changelog

## [1.19.1](https://github.com/huishouden/pet/compare/v1.19.0...v1.19.1) (2026-10-05)

### Bug Fixes

* a change saved just before the app closed and written again when it next opens never puts back an older value; another member's newer change is kept (pwa-kit 0.102.0)

## [1.19.0](https://github.com/huishouden/pet/compare/v1.18.0...v1.19.0) (2026-10-05)

### Features

* hashed assets from the suite's asset CDN (pwa-kit 0.100.0) ([816baa5](https://github.com/huishouden/pet/commit/816baa58d21323a6734ce1a6dfd0a8eaebb78485))

## [1.18.0](https://github.com/huishouden/pet/compare/v1.17.0...v1.18.0) (2026-10-05)

### Features

* **scan:** Scan the label takes a photo, a chosen photo, paste, drop and several; Share to Pet (kit 0.99.0) ([a6a7e9e](https://github.com/huishouden/pet/commit/a6a7e9e32c24574813a895e1ed6e50b41a5ac155))

## [1.17.0](https://github.com/huishouden/pet/compare/v1.16.3...v1.17.0) (2026-10-05)

### Features

* **reminders:** dose, meal and birthday reminders name what they are about ([5d7a026](https://github.com/huishouden/pet/commit/5d7a026ec78daaf54a0ed157929d628a30d1c1ca))

### Other

* docs, review: reminders that stop once done elsewhere ([98e7523](https://github.com/huishouden/pet/commit/98e7523fc3b4cf36a1f1674d9397e1161213b371))

## [1.16.3](https://github.com/huishouden/pet/compare/v1.16.2...v1.16.3) (2026-10-05)

### Tests

* signed-in tests on a household of the run's own; all but the portal To-do round trip run on the emulators (`bun run e2e:emulator`) ([#57](https://github.com/huishouden/pet/issues/57))

## [1.16.2](https://github.com/huishouden/pet/compare/v1.16.1...v1.16.2) (2026-10-05)

### Other

* Maintenance

## [1.16.1](https://github.com/huishouden/pet/compare/v1.16.0...v1.16.1) (2026-10-05)


### Bug Fixes

* **today:** done and not done look different on the board, Needs doing and Care ([#65](https://github.com/huishouden/pet/issues/65)) ([2b8243b](https://github.com/huishouden/pet/commit/2b8243bd5ad744eada7dccb25e1baa78fa82b370))

## [1.16.0](https://github.com/huishouden/pet/compare/v1.15.1...v1.16.0) (2026-10-04)


### Features

* **contacts:** the vet's distance from home on its card and appointments (kit 0.84.0) ([#63](https://github.com/huishouden/pet/issues/63)) ([f3cc077](https://github.com/huishouden/pet/commit/f3cc077699d0236ad215e9a7c8dd51be6641f20d))

## [1.15.1](https://github.com/huishouden/pet/compare/v1.15.0...v1.15.1) (2026-10-04)


### Bug Fixes

* kit v0.74.0 to 0.82.1, contacts' pay details for admins and members only ([#61](https://github.com/huishouden/pet/issues/61)) ([d408b57](https://github.com/huishouden/pet/commit/d408b5762dcec72b6f7b01c8a7d2cd8d45f55653))

## [1.15.0](https://github.com/huishouden/pet/compare/v1.14.1...v1.15.0) (2026-10-04)


### Features

* **calendar:** appointments and care reminders come back from Google Calendar; Add to calendar on appointments, reminders and courses (kit v0.67.0) ([#53](https://github.com/huishouden/pet/issues/53)) ([e998821](https://github.com/huishouden/pet/commit/e9988212545d6f4e7d69b911f97ef8748cc8b90c))


### Bug Fixes

* **dark:** pet avatars keep an edge in dark; kit 0.70.0 ([#56](https://github.com/huishouden/pet/issues/56)) ([f7d22a2](https://github.com/huishouden/pet/commit/f7d22a21ce53a14426a32dd1063051ab318699d6))

## [1.14.1](https://github.com/huishouden/pet/compare/v1.14.0...v1.14.1) (2026-10-04)


### Bug Fixes

* Pet's Spanish and Dutch name and role words match the portal's ([#51](https://github.com/huishouden/pet/issues/51)) ([3de7f2e](https://github.com/huishouden/pet/commit/3de7f2ec734be07e03f4fb22f84d3c3fbcaed537))

## [1.14.0](https://github.com/huishouden/pet/compare/v1.13.0...v1.14.0) (2026-10-04)


### Features

* Pet in Spanish and Dutch ([#49](https://github.com/huishouden/pet/issues/49)) ([53752e0](https://github.com/huishouden/pet/commit/53752e0a9b6173a082421f1062737c64f8281831))

## [1.13.0](https://github.com/huishouden/pet/compare/v1.12.0...v1.13.0) (2026-10-03)


### Features

* dark mode that follows the suite's theme ([#47](https://github.com/huishouden/pet/issues/47)) ([79e1f2a](https://github.com/huishouden/pet/commit/79e1f2a36965e0f503b525ebbf16255db8985c74))

## [1.12.0](https://github.com/huishouden/pet/compare/v1.11.1...v1.12.0) (2026-10-03)


### Features

* Scan the label shows what it filled and what it did not use (kit 0.56.0) ([#45](https://github.com/huishouden/pet/issues/45)) ([992b439](https://github.com/huishouden/pet/commit/992b439ee415d8193aa15e4cfdbf9bee0d4a224a))

## [1.11.1](https://github.com/huishouden/pet/compare/v1.11.0...v1.11.1) (2026-10-03)


### Bug Fixes

* a dose to-do logs its own slot's time, never today's ([#43](https://github.com/huishouden/pet/issues/43)) ([10de464](https://github.com/huishouden/pet/commit/10de464ae761ce6b72eb6be30071f0a1981818d1))

## [1.11.0](https://github.com/huishouden/pet/compare/v1.10.0...v1.11.0) (2026-10-03)


### Features

* publish due care and today's doses to the household to-do list ([#41](https://github.com/huishouden/pet/issues/41)) ([8b9d07a](https://github.com/huishouden/pet/commit/8b9d07abf50593e86966923757bf417dcc466af5))

## [1.10.0](https://github.com/huishouden/pet/compare/v1.9.1...v1.10.0) (2026-10-03)


### Features

* sections in a bottom bar on phones (kit 0.52.0) ([#39](https://github.com/huishouden/pet/issues/39)) ([d701114](https://github.com/huishouden/pet/commit/d70111432d2878d23feff85a7e11af8f9f2225ca))

## [1.9.1](https://github.com/huishouden/pet/compare/v1.9.0...v1.9.1) (2026-10-03)


### Bug Fixes

* dialogs keep focus where it was tapped on phones (pwa-kit 0.51.0) ([#37](https://github.com/huishouden/pet/issues/37)) ([daff60b](https://github.com/huishouden/pet/commit/daff60bcc30d85e6fde37b65b7891e0e50a83e00))

## [1.9.0](https://github.com/huishouden/pet/compare/v1.8.0...v1.9.0) (2026-10-03)


### Features

* Pet moves to /pet/ on the suite's one site (pwa-kit 0.48.0) ([#35](https://github.com/huishouden/pet/issues/35)) ([ff84a80](https://github.com/huishouden/pet/commit/ff84a80a988c52f1537d78b46dc68496692cdc36))

## [1.8.0](https://github.com/huishouden/pet/compare/v1.7.1...v1.8.0) (2026-10-03)


### Features

* **contacts:** add a vet or sitter from your own contacts; contact cards in the Share menu ([#33](https://github.com/huishouden/pet/issues/33)) ([81a6b18](https://github.com/huishouden/pet/commit/81a6b180bfa528d6593a469c633952bce6e7cba4))

## [1.7.1](https://github.com/huishouden/pet/compare/v1.7.0...v1.7.1) (2026-10-03)


### Bug Fixes

* **agenda:** publish tomorrow's meals as well as today's ([#31](https://github.com/huishouden/pet/issues/31)) ([68d6d98](https://github.com/huishouden/pet/commit/68d6d983cc8c437c8a3c37027ef24382e5ef005c))

## [1.7.0](https://github.com/huishouden/pet/compare/v1.6.0...v1.7.0) (2026-10-03)


### Features

* **security:** security headers; one-line Sample data banner on phones ([#28](https://github.com/huishouden/pet/issues/28)) ([3507b9a](https://github.com/huishouden/pet/commit/3507b9ae365f967e2ce4f21e7f8390c862b066c1))

## [1.6.0](https://github.com/huishouden/pet/compare/v1.5.1...v1.6.0) (2026-10-02)


### Features

* error, speed and anonymous usage reports (pwa-kit observability) ([#23](https://github.com/huishouden/pet/issues/23)) ([8458dad](https://github.com/huishouden/pet/commit/8458dad41f916036eaae9e4475cb37dab764ec51))
* **roles:** helpers and kids in Pet: who can give a course, private appointments, own records only ([#27](https://github.com/huishouden/pet/issues/27)) ([277efef](https://github.com/huishouden/pet/commit/277efefdb5cf36de43870cf3ff5a1d30b6686065))

## [1.5.1](https://github.com/huishouden/pet/compare/v1.5.0...v1.5.1) (2026-10-02)


### Bug Fixes

* an entry saved just before the app closes is no longer lost ([#22](https://github.com/huishouden/pet/issues/22)) ([e90927d](https://github.com/huishouden/pet/commit/e90927d1d1e6be3c874b6afb6c2ff1577c0612f0))

## [1.5.0](https://github.com/huishouden/pet/compare/v1.4.0...v1.5.0) (2026-10-02)


### Features

* offer new calendar events on the main screen ([#21](https://github.com/huishouden/pet/issues/21)) ([e3dffc4](https://github.com/huishouden/pet/commit/e3dffc48fb3452083542bb418542eaea1da119be))

## [1.4.0](https://github.com/huishouden/pet/compare/v1.3.0...v1.4.0) (2026-10-02)


### Features

* Today leads with what needs doing for the pets right now ([#19](https://github.com/huishouden/pet/issues/19)) ([ae9b66e](https://github.com/huishouden/pet/commit/ae9b66e5c173ae90588b05c3b88be8bababdacfc))

## [1.3.0](https://github.com/huishouden/pet/compare/v1.2.0...v1.3.0) (2026-10-02)


### Features

* publish appointments, care, courses, birthdays and today's meals to the household agenda ([#15](https://github.com/huishouden/pet/issues/15)) ([147e1b3](https://github.com/huishouden/pet/commit/147e1b3deaaffb6492d7a61531e901056ea53b27))


### Bug Fixes

* collapse the label text a scan didn't use ([#16](https://github.com/huishouden/pet/issues/16)) ([2f2ff68](https://github.com/huishouden/pet/commit/2f2ff68c8e2d5a78736885a8413c17b01eb11da6))

## [1.2.0](https://github.com/huishouden/pet/compare/v1.1.1...v1.2.0) (2026-10-02)


### Features

* **contacts:** open a new contact from Google Maps' Share menu; fill from a screenshot or pasted listing ([#14](https://github.com/huishouden/pet/issues/14)) ([ce3ba5f](https://github.com/huishouden/pet/commit/ce3ba5f45e4e6797b16ff00444da2212638617f5))
* mark earlier days' doses and meals as given ([#11](https://github.com/huishouden/pet/issues/11)) ([154f7bf](https://github.com/huishouden/pet/commit/154f7bf85106d1049410641cd058ea77fb030f73))
* pet photos as avatars (kit v0.27.0) ([#13](https://github.com/huishouden/pet/issues/13)) ([59e3e80](https://github.com/huishouden/pet/commit/59e3e80b63e6c4d50ca528a4b81a262f7ad0d6c7))

## [1.1.1](https://github.com/huishouden/pet/compare/v1.1.0...v1.1.1) (2026-10-02)


### Bug Fixes

* ask for an age or year instead of trusting a calendar series as the birth year; age without a birthday ([#9](https://github.com/huishouden/pet/issues/9)) ([b41aa70](https://github.com/huishouden/pet/commit/b41aa701840fe0d8c4b2eb7b8f1d7439c4f7b93e))

## [1.1.0](https://github.com/huishouden/pet/compare/v1.0.1...v1.1.0) (2026-10-02)


### Features

* birthdays from the calendar, and a target weight per pet (kit v0.23.0) ([#6](https://github.com/huishouden/pet/issues/6)) ([cad1550](https://github.com/huishouden/pet/commit/cad15505b816ff6cebd99eac7336065817f0b7a6))

## [1.0.1](https://github.com/huishouden/pet/compare/v1.0.0...v1.0.1) (2026-10-02)


### Bug Fixes

* Google API tokens from Google Identity Services, not Firebase sign-in (kit v0.23.0) ([#4](https://github.com/huishouden/pet/issues/4)) ([72ae09b](https://github.com/huishouden/pet/commit/72ae09be1dce535d8557b5002e6f235813f5b4fb))

## 1.0.0 (2026-10-02)


### Features

* Huishouden Pet, a shared feeding and medicine board, care reminders, vet visits, weight and records for the household's pets ([95e1f79](https://github.com/huishouden/pet/commit/95e1f79480999ba2d526c03377a9aac2faef34dc))
* scan a medicine label into a course, and notifications for doses and unticked meals ([#2](https://github.com/huishouden/pet/issues/2)) ([05922c3](https://github.com/huishouden/pet/commit/05922c327355b5768c273f1200f5186de8bbdae3))
