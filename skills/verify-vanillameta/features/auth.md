# Authentication and session

## Sub-features
Login with userId/password, token issuance, logout, invalid credentials rejected.

## How to get to it (user POV)
Open /login, enter credentials, submit.

## Driving it with Playwright
POST /v1/login/signin with {"userId":"guest","password":"Admin!@12"} and assert accessToken exists. UI: fill the two labeled fields and click Login.

## Gotchas
The local seed user has no organization. UI login can bounce back to /login when organization-scoped guards run; the API token still authenticates. Record which surface failed instead of assuming success.

