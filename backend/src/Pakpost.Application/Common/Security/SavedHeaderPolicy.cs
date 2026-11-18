using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using Pakpost.Application.Common.Exceptions;

namespace Pakpost.Application.Common.Security;

public static partial class SavedHeaderPolicy
{
    private const string MetadataKey="__pakpost_request_meta_v1__";
    private static readonly HashSet<string> SensitiveHeaders=new(StringComparer.OrdinalIgnoreCase)
    {
        "Authorization", "Proxy-Authorization", "Cookie", "Set-Cookie", "X-API-Key", "Api-Key",
        "X-Auth-Token", "X-Access-Token", "X-Client-Secret", "X-Secret-Key"
    };

    [GeneratedRegex(@"^\s*(?:(?:Bearer|Basic|Token)\s+)?(?:\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}|<<[a-zA-Z_][a-zA-Z0-9_]*>>)\s*$",RegexOptions.IgnoreCase|RegexOptions.CultureInvariant)]
    private static partial Regex PlaceholderValue();

    private static bool IsUnsafe(string key,string? value)
        => SensitiveHeaders.Contains(key.Trim()) && !string.IsNullOrWhiteSpace(value) && !PlaceholderValue().IsMatch(value);

    public static bool ContainsNoLiteralCredentials(string? headersJson)
    {
        try
        {
            using var json=JsonDocument.Parse(headersJson??"{}");
            if(json.RootElement.ValueKind!=JsonValueKind.Object)return false;
            foreach(var header in json.RootElement.EnumerateObject())
            {
                if(header.NameEquals(MetadataKey))
                {
                    if(header.Value.ValueKind==JsonValueKind.Object &&
                       header.Value.TryGetProperty("headers",out var rows) && rows.ValueKind==JsonValueKind.Array)
                        foreach(var row in rows.EnumerateArray())
                        {
                            if(row.ValueKind!=JsonValueKind.Object)continue;
                            var key=row.TryGetProperty("key",out var k)&&k.ValueKind==JsonValueKind.String?k.GetString():null;
                            var hasValue=row.TryGetProperty("value",out var v);
                            if(key is not null && SensitiveHeaders.Contains(key.Trim()))
                            {
                                if(hasValue && v.ValueKind is not JsonValueKind.String and not JsonValueKind.Null)return false;
                                if(IsUnsafe(key,hasValue&&v.ValueKind==JsonValueKind.String?v.GetString():null))return false;
                            }
                        }
                }
                else if(SensitiveHeaders.Contains(header.Name.Trim()))
                {
                    if(header.Value.ValueKind is not JsonValueKind.String and not JsonValueKind.Null)return false;
                    if(IsUnsafe(header.Name,header.Value.ValueKind==JsonValueKind.String?header.Value.GetString():null))return false;
                }
            }
            return true;
        }
        catch(JsonException){return false;}
    }

    public static void EnsureSafe(string? headersJson)
    {
        if(!ContainsNoLiteralCredentials(headersJson))
            throw AppException.BadRequest("Saved headers cannot contain literal credentials. Use {{token}} or {{apiKey}} variables instead.");
    }

    // Existing records are NOT overwritten automatically. Values are removed from API responses,
    // while database cleanup/rotation remains a separate reviewed operator action.
    public static string RedactLegacyCredentials(string? headersJson)
    {
        try
        {
            var root=JsonNode.Parse(headersJson??"{}") as JsonObject;
            if(root is null)return "{}";
            foreach(var entry in root.ToList())
            {
                if(entry.Key==MetadataKey)continue;
                if(SensitiveHeaders.Contains(entry.Key.Trim()) && (entry.Value is not JsonValue || IsUnsafe(entry.Key,AsString(entry.Value))))
                    root[entry.Key]=string.Empty;
            }
            if(root[MetadataKey] is JsonObject metadata && metadata["headers"] is JsonArray rows)
                foreach(var row in rows.OfType<JsonObject>())
                {
                    var key=AsString(row["key"]);
                    if(key is not null && SensitiveHeaders.Contains(key.Trim()) &&
                       (row["value"] is not JsonValue || IsUnsafe(key,AsString(row["value"]))))
                        row["value"]=string.Empty;
                }
            return root.ToJsonString();
        }
        catch(JsonException){return "{}";}
    }

    private static string? AsString(JsonNode? node)
    {
        try{return (node as JsonValue)?.GetValue<string>();}
        catch(InvalidOperationException){return null;}
        catch(FormatException){return null;}
    }
}
