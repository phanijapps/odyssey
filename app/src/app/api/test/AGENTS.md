# Assessment API guide

`/api/test` owns learner-scoped assessment start/resume/read; `answer/` grades only
the server-issued assignment token; `exit/` records a partial terminal result.
Preserve opaque assignment-token replay protection, end-only feedback, and test
isolation from practice mastery. Do not accept client scores, topic bindings, or
answer keys.
