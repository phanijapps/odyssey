# History API guide

`/api/history` returns a redacted, learner-scoped chronological projection of
practice attempts and terminal assessments. It is read-only and must never expose
raw submitted answers or mutate mastery/progress.
