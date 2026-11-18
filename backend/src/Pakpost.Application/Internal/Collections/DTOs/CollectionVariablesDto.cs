using System.Text.Json;
using FluentValidation;
using Mediator;
using Pakpost.Application.Common.Exceptions;
using Pakpost.Application.Common.Interfaces;
using Pakpost.Application.Common.Security;

namespace Pakpost.Application.Internal.Collections;

public sealed record CollectionVariablesDto(int Version, IReadOnlyList<CollectionVariableDto> Variables);
