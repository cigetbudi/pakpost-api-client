
namespace Pakpost.Application.Internal.Teams.DTOs;

public sealed record TeamMemberDto(Guid UserId, string Email, string DisplayName);
