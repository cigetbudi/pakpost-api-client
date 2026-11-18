using System.Text.Json;

namespace Pakpost.Application.Internal.Collections.DTOs;

public sealed record CollectionVariableDto(string Key, string Value, bool IsSecret = false, bool IsRedacted = false);
