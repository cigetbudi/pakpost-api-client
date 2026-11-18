using System.Text.Json;

namespace Pakpost.Application.Internal.Collections.DTOs;

public sealed record CloudImportRequest(string Name, string Method, string Url, string HeadersJson,
    string Body, string BodyMode = "raw", string ContentType = "application/json",
    string FormFieldsJson = "[]", string PreRequestScript = "", string PostResponseScript = "", List<string>? FolderPath = null);
