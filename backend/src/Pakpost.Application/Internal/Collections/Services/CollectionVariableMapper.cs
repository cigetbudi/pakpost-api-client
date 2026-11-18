using System.Text.Json;
using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;

namespace Pakpost.Application.Internal.Collections;

internal static class CollectionVariableMapper
{
    private static readonly JsonSerializerOptions Options = new() {PropertyNameCaseInsensitive = true};
    public static List<StoredCollectionVariable> Read(string json)
    => JsonSerializer.Deserialize<List<StoredCollectionVariable>>(json, Options)??[];

    public static CollectionVariablesDto ToDto(int version, List<StoredCollectionVariable> values,
        IEnvironmentValueCipher cipher, bool canReadSecrets)
    => new(version, values.Select(v => new CollectionVariableDto(v.Key,
        v.IsSecret?(canReadSecrets?cipher.Unprotect(v.StoredValue):string.Empty):v.StoredValue,
        v.IsSecret, v.IsSecret && !canReadSecrets)).ToArray());

    private static bool IsSensitiveKey(string key)
    {
        var name = key.ToLowerInvariant();
        return name.Contains("token") || name.Contains("password") || name.Contains("secret")
        || name.Contains("apikey") || name.Contains("api_key") || name.Contains("authorization");
    }

    public static List<StoredCollectionVariable> ToStored(IReadOnlyList<CollectionVariableDto> incoming,
        List<StoredCollectionVariable> before, IEnvironmentValueCipher cipher)
    {
        var prior = before.ToDictionary(x => x.Key, StringComparer.OrdinalIgnoreCase);
        return incoming.Select(v =>
            {
                if (v.IsRedacted)
                {
                    // An unreadable existing secret must be preserved without disclosing its value.
                    if (!prior.TryGetValue(v.Key, out var old) || !old.IsSecret || !v.IsSecret || v.Value.Length>0)
                    throw AppException.BadRequest("Invalid redacted collection variable: "+v.Key);
                    return new StoredCollectionVariable(v.Key, old.StoredValue, true);
                }
                bool secret = v.IsSecret || IsSensitiveKey(v.Key);
                return new StoredCollectionVariable(v.Key, secret?cipher.Protect(v.Value):v.Value, secret);
            }).ToList();
    }
}
