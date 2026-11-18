using System.Text.Json;

namespace Pakpost.Application.Internal.Collections.Services;

internal sealed record StoredCollectionVariable(string Key, string StoredValue, bool IsSecret);
