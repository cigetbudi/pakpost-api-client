using System.Text.Json;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Internal.Collections.DTOs;
using Pakpost.Domain.Entities;

namespace Pakpost.Application.Internal.Collections.Services;

public sealed record CollectionScriptSettings(string PreScript, string PostScript)
{
    public static CollectionScriptSettings Read(Collection item) => item.ScriptsJson is null
        ? new("", "")
        : JsonSerializer.Deserialize<CollectionScriptSettings>(item.ScriptsJson)
            ?? throw new InvalidOperationException("Invalid collection script settings");

    public static void Apply(Collection item, string? pre, string? post)
    {
        if (pre is null && post is null) return; // Older clients edit variables only.
        var before = Read(item);
        var next = new CollectionScriptSettings(pre ?? before.PreScript, post ?? before.PostScript);
        if (next.PreScript.Length > 64000 || next.PostScript.Length > 64000)
            throw AppException.BadRequest("Collection scripts exceed 64000 characters each");
        if (next == before) return;
        item.SetScripts(JsonSerializer.Serialize(next));
    }

    public static CollectionVariablesDto WithScripts(Collection item, CollectionVariablesDto dto)
    {
        var scripts = Read(item);
        return dto with { PreScript = scripts.PreScript, PostScript = scripts.PostScript };
    }
}
