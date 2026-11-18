
namespace Pakpost.Application.Internal.Environments.DTOs;

public sealed record RequestEnvironmentDto(Guid Id, string Name, IReadOnlyList<EnvironmentVariableDto> Variables);
