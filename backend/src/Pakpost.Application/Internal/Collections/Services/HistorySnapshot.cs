using System.Text.Json;

namespace Pakpost.Application.Internal.Collections.Services;

internal sealed record HistorySnapshot(string Name, string Method, string Url, string HeadersJson, string Body,
    string BodyMode, string ContentType, string FormFieldsJson, string PreRequestScript, string PostResponseScript);
