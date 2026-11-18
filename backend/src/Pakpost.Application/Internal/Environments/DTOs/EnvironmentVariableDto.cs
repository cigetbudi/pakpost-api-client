
namespace Pakpost.Application.Internal.Environments.DTOs;

public sealed record EnvironmentVariableDto(string Key, string Value, bool IsSecret, bool IsRedacted = false);
