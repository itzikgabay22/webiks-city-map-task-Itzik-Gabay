{{- define "citymap.labels" -}}
app.kubernetes.io/part-of: citymap
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ .Chart.Name }}-{{ .Chart.Version }}
{{- end -}}

{{- define "citymap.image" -}}
{{ .repository }}:{{ .tag }}
{{- end -}}

{{- define "citymap.databaseUrl" -}}
postgres://{{ .Values.postgis.user }}:$(DB_PASSWORD)@{{ .Release.Name }}-postgis:5432/{{ .Values.postgis.database }}
{{- end -}}
